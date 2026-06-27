"""Pydantic schemas for all API contracts."""
from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, field_validator


class RiskTolerance(str, Enum):
    conservative = "conservative"
    moderate = "moderate"
    aggressive = "aggressive"


class RegimeName(str, Enum):
    bull = "bull"
    bear = "bear"
    high_vol = "high_vol"
    ranging = "ranging"


class GateStatus(str, Enum):
    active = "active"
    degraded = "degraded"
    blocked = "blocked"


class TradeAction(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    done = "done"
    error = "error"


class HoldingInput(BaseModel):
    ticker: str = Field(..., description="NSE ticker e.g. RELIANCE.NS")
    shares: float = Field(..., gt=0)
    avg_buy_price: float = Field(..., gt=0)
    current_price: float | None = None
    sector: str | None = None


class PortfolioInput(BaseModel):
    holdings: list[HoldingInput] = Field(default_factory=list)
    total_invested_inr: float = Field(..., gt=0)
    cash_inr: float = Field(default=0.0, ge=0)
    demat_id: str | None = None


class InvestmentGoal(BaseModel):
    return_target: float = Field(default=0.15, ge=0.0, le=5.0)
    max_drawdown: float = Field(default=0.10, ge=0.0, le=1.0)
    sectors_excluded: list[str] = Field(default_factory=list)
    capital_inr: float = Field(default=500000.0, gt=0)
    horizon_days: int = Field(default=252, gt=0, le=3650)
    risk_tolerance: RiskTolerance = RiskTolerance.moderate


class AnalyzeRequest(BaseModel):
    nl_goal: str = Field(..., min_length=5, max_length=2000)
    portfolio: list[PortfolioInput] = Field(default_factory=list)
    parsed_goal: InvestmentGoal | None = None


class AlphaSignal(BaseModel):
    ticker: str
    kan_alpha: float
    lgbm_alpha: float
    patchtst_alpha: float
    il_alpha: float
    final_alpha: float
    shap_data: dict[str, float] = Field(default_factory=dict)
    gate_active: bool = True


class RegimeState(BaseModel):
    state: RegimeName
    confidence: float = Field(..., ge=0.0, le=1.0)
    kelly_factor: float = Field(..., ge=0.0, le=1.0)
    model_ic: float
    gate_status: GateStatus
    transition_prob: list[float] = Field(default_factory=list)


class TradeCommand(BaseModel):
    ticker: str
    action: TradeAction
    quantity: int
    amount_inr: float
    lot_compliant: bool
    reason: str = ""


class RiskMetrics(BaseModel):
    var_95: float
    var_99: float
    cvar_95: float
    cvar_99: float
    max_drawdown: float
    portfolio_volatility: float
    portfolio_return_expected: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    mc_percentile_5: list[float]
    mc_percentile_50: list[float]
    mc_percentile_95: list[float]
    mc_horizon_days: int


class BacktestPeriod(BaseModel):
    start: str
    end: str
    strategy_return: float
    nifty_return: float
    alpha: float
    sharpe: float
    sortino: float
    calmar: float
    max_drawdown: float
    hit_rate: float
    ic: float


class BacktestMetrics(BaseModel):
    periods: list[BacktestPeriod]
    summary_sharpe: float
    summary_calmar: float
    summary_alpha: float
    summary_max_drawdown: float
    ic_ir: float


class PortfolioResult(BaseModel):
    job_id: str
    regime: RegimeState
    goal: InvestmentGoal
    signals: list[AlphaSignal]
    weights: dict[str, float]
    commands: list[TradeCommand]
    risk: RiskMetrics
    backtest: BacktestMetrics
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AnalyzeResponse(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.queued


class StatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(0, ge=0, le=100)
    message: str = ""
    error: str | None = None


class ScenarioRequest(BaseModel):
    job_id: str
    scenario_type: str = Field(..., pattern="^(2008|covid|rate_hike_2022|custom)$")
    custom_shock: dict[str, float] | None = None
