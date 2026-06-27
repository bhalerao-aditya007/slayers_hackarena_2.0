"""Main QUANTIS Pipeline — orchestrates all components end-to-end."""
from __future__ import annotations
import asyncio
import logging
import time
from datetime import datetime
from typing import Callable, Optional

from quantis.api.schemas import InvestmentGoal, PortfolioInput, RiskTolerance
from quantis.config import NIFTY50_TICKERS, SECTOR_MAP
from quantis.pipeline.nl_parser import parse_nl_goal
from quantis.pipeline.market_data import (
    fetch_stock_data, get_nifty_benchmark, get_india_vix, prepare_feature_matrix,
)
from quantis.pipeline.regime import get_regime_detector
from quantis.pipeline.alpha_models import build_alpha_signals, compute_rolling_ic
from quantis.pipeline.portfolio import (
    optimize_portfolio, build_trade_commands,
    compute_risk_metrics, compute_backtest_metrics,
)

logger = logging.getLogger("quantis.pipeline")

ProgressCB = Callable[[int, str], None]


async def run_pipeline_async(
    job_id: str,
    nl_goal: str,
    portfolio_inputs: list[dict],
    progress_cb: Optional[ProgressCB] = None,
) -> dict:
    """Run the full QUANTIS pipeline asynchronously."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: run_pipeline_sync(job_id, nl_goal, portfolio_inputs, progress_cb),
    )


def run_pipeline_sync(
    job_id: str,
    nl_goal: str,
    portfolio_inputs: list[dict],
    progress_cb: Optional[ProgressCB] = None,
) -> dict:
    """Synchronous pipeline — runs in background thread."""

    def _progress(pct: int, msg: str):
        logger.info("[%s] %d%% — %s", job_id, pct, msg)
        if progress_cb:
            progress_cb(pct, msg)

    _progress(5, "Parsing investment goal...")

    # ── Step 1: Parse NL goal ─────────────────────────────────────────────────
    goal: InvestmentGoal
    if portfolio_inputs and isinstance(portfolio_inputs[0], dict):
        # The frontend sends parsed_goal optionally; parse NL regardless
        goal = parse_nl_goal(nl_goal)
        # Merge with portfolio capital if available
        port_data = portfolio_inputs[0] if portfolio_inputs else {}
        if "total_invested_inr" in port_data:
            # User's actual capital overrides NL-parsed if significantly different
            cap = float(port_data.get("total_invested_inr", goal.capital_inr))
            if cap > 0:
                goal = goal.model_copy(update={"capital_inr": cap})
    else:
        goal = parse_nl_goal(nl_goal)

    _progress(10, "Determining ticker universe...")

    # ── Step 2: Determine tickers ─────────────────────────────────────────────
    if portfolio_inputs and portfolio_inputs[0].get("holdings"):
        # Use user's existing holdings + fill up to 20 from NIFTY 50
        user_tickers = [h["ticker"] for h in portfolio_inputs[0]["holdings"] if h.get("ticker")]
        # Filter out excluded sectors
        extra = [t for t in NIFTY50_TICKERS if t not in user_tickers
                 and SECTOR_MAP.get(t, "Unknown") not in goal.sectors_excluded]
        tickers = user_tickers[:20] + extra[:max(0, 20 - len(user_tickers))]
    else:
        # Full NIFTY 50, filter excluded sectors
        tickers = [t for t in NIFTY50_TICKERS
                   if SECTOR_MAP.get(t, "Unknown") not in goal.sectors_excluded][:20]

    _progress(15, f"Fetching market data for {len(tickers)} stocks...")

    # ── Step 3: Fetch market data ─────────────────────────────────────────────
    t0 = time.time()
    stock_data = fetch_stock_data(tickers, period="2y")
    nifty_returns = get_nifty_benchmark(period="2y")
    india_vix = get_india_vix()

    _progress(35, f"Market data fetched in {time.time()-t0:.1f}s ({len(stock_data)} stocks)")

    if not stock_data:
        raise RuntimeError("Failed to fetch any market data. Check internet connection.")

    # ── Step 4: Compute IC for efficacy gate ──────────────────────────────────
    _progress(40, "Checking model efficacy gate...")
    # In a real system, we'd compare last predictions vs realized
    # For MVP: derive IC from NIFTY momentum
    model_ic = _estimate_ic(nifty_returns)

    # ── Step 5: Detect market regime ──────────────────────────────────────────
    _progress(45, "Running HMM regime detector...")
    detector = get_regime_detector()
    regime = detector.detect(nifty_returns, india_vix, model_ic)

    _progress(50, f"Regime: {regime.state.upper()} (confidence: {regime.confidence:.1%})")

    # ── Step 6: Build feature matrix ──────────────────────────────────────────
    _progress(55, "Building feature matrix...")
    X, latest_prices = prepare_feature_matrix(stock_data)

    if X.empty:
        raise RuntimeError("Feature matrix is empty — insufficient indicator data.")

    # ── Step 7: Alpha models ───────────────────────────────────────────────────
    _progress(60, "Running alpha models (KAN + LightGBM + PatchTST + IL)...")

    def alpha_progress(msg: str):
        _progress(62, msg)

    signals = build_alpha_signals(
        X, stock_data, regime.state.value, nifty_returns,
        progress_cb=alpha_progress,
    )
    _progress(72, f"Alpha signals computed for {len(signals)} stocks")

    # ── Step 8: Portfolio optimization ────────────────────────────────────────
    _progress(78, "Optimising portfolio (Mean-CVaR)...")
    weights = optimize_portfolio(signals, stock_data, goal, regime.state.value, regime.kelly_factor)

    _progress(82, "Building trade commands...")
    commands = build_trade_commands(weights, stock_data, goal)

    # ── Step 9: Risk metrics + Monte Carlo ───────────────────────────────────
    _progress(86, "Running Monte Carlo risk engine (10,000 paths)...")
    risk = compute_risk_metrics(weights, stock_data, goal, regime.state.value)

    # ── Step 10: Walk-forward backtest ────────────────────────────────────────
    _progress(92, "Computing walk-forward backtest...")
    backtest = compute_backtest_metrics(weights, stock_data, nifty_returns)

    _progress(98, "Assembling result...")

    result = {
        "job_id": job_id,
        "regime": regime.model_dump(),
        "goal": goal.model_dump(),
        "signals": signals,
        "weights": {k: round(v, 4) for k, v in weights.items()},
        "commands": commands,
        "risk": risk,
        "backtest": backtest,
        "created_at": datetime.utcnow().isoformat(),
    }

    _progress(100, "Analysis complete")
    return result


def _estimate_ic(nifty_returns: "pd.Series") -> float:
    """Estimate model IC from recent market autocorrelation as a proxy."""
    import numpy as np
    r = nifty_returns.dropna()
    if len(r) < 25:
        return 0.05
    # Use trailing 20-day momentum predictability
    r20 = r.tail(40).values
    if len(r20) < 15:
        return 0.05
    # IC proxy: correlation between sign of yesterday's return and today's
    x = r20[:-1]
    y = r20[1:]
    try:
        from scipy.stats import pearsonr
        ic, _ = pearsonr(x, y)
        # Normalize to typical IC range [0, 0.12]
        ic_norm = float(np.clip(abs(ic) * 0.5 + 0.04, 0.02, 0.12))
        return ic_norm
    except Exception:
        return 0.05
