"""Market Data Pipeline — yfinance + pandas_ta indicators for NSE stocks."""
from __future__ import annotations
import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("quantis.data")

# TA features we compute per stock
TA_COLS = [
    "rsi_14", "rsi_21", "macd", "macd_hist", "macd_signal",
    "bb_upper", "bb_lower", "bb_pct", "bb_width",
    "atr_14", "obv", "stoch_k", "stoch_d",
    "adx_14", "cci_14", "williams_r", "mfi_14",
    "roc_10", "sma_20", "sma_50", "ema_21",
]

# Final feature set (subset of TA_COLS after filling — 20 features)
FEATURE_COLS = [
    "rsi_14", "rsi_21", "macd_hist", "bb_pct", "bb_width",
    "atr_14", "stoch_k", "adx_14", "cci_14", "roc_10",
    "obv_norm", "mfi_14", "williams_r",
    "ret_1d", "ret_5d", "ret_20d",
    "vol_20d", "vol_ratio",
    "sma_ratio_20", "sma_ratio_50",
]


def fetch_stock_data(tickers: list[str], period: str = "2y") -> dict[str, pd.DataFrame]:
    """
    Fetch OHLCV data for each ticker and compute technical indicators.
    Returns dict ticker -> DataFrame with FEATURE_COLS columns.
    """
    import yfinance as yf

    result: dict[str, pd.DataFrame] = {}
    for ticker in tickers:
        try:
            df = yf.download(ticker, period=period, auto_adjust=True, progress=False)
            if df is None or len(df) < 60:
                logger.warning("Insufficient data for %s (%d rows)", ticker, len(df) if df is not None else 0)
                continue
            df = df.copy()
            df.columns = [c.lower() for c in df.columns]
            df = _add_indicators(df)
            df = df.dropna(subset=FEATURE_COLS)
            if len(df) >= 30:
                result[ticker] = df
        except Exception as e:
            logger.warning("Failed to fetch %s: %s", ticker, e)
    return result


def _add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add TA indicators using pandas-ta."""
    try:
        import pandas_ta as ta
        # RSI
        df["rsi_14"] = ta.rsi(df["close"], length=14)
        df["rsi_21"] = ta.rsi(df["close"], length=21)
        # MACD
        macd = ta.macd(df["close"], fast=12, slow=26, signal=9)
        if macd is not None and not macd.empty:
            df["macd"] = macd.iloc[:, 0]
            df["macd_hist"] = macd.iloc[:, 1]
            df["macd_signal"] = macd.iloc[:, 2]
        # Bollinger Bands
        bb = ta.bbands(df["close"], length=20, std=2)
        if bb is not None and not bb.empty:
            df["bb_upper"] = bb.iloc[:, 0]
            df["bb_lower"] = bb.iloc[:, 2]
            df["bb_pct"] = bb.iloc[:, 3] if bb.shape[1] > 3 else (df["close"] - bb.iloc[:, 2]) / (bb.iloc[:, 0] - bb.iloc[:, 2] + 1e-8)
            df["bb_width"] = (bb.iloc[:, 0] - bb.iloc[:, 2]) / (bb.iloc[:, 1] + 1e-8)
        # ATR
        df["atr_14"] = ta.atr(df["high"], df["low"], df["close"], length=14)
        # OBV
        df["obv"] = ta.obv(df["close"], df["volume"])
        # Stochastic
        stoch = ta.stoch(df["high"], df["low"], df["close"])
        if stoch is not None and not stoch.empty:
            df["stoch_k"] = stoch.iloc[:, 0]
            df["stoch_d"] = stoch.iloc[:, 1]
        # ADX
        adx = ta.adx(df["high"], df["low"], df["close"], length=14)
        if adx is not None and not adx.empty:
            df["adx_14"] = adx.iloc[:, 0]
        # CCI
        df["cci_14"] = ta.cci(df["high"], df["low"], df["close"], length=14)
        # Williams %R
        df["williams_r"] = ta.willr(df["high"], df["low"], df["close"], length=14)
        # MFI
        df["mfi_14"] = ta.mfi(df["high"], df["low"], df["close"], df["volume"], length=14)
        # ROC
        df["roc_10"] = ta.roc(df["close"], length=10)
        # SMA / EMA
        df["sma_20"] = ta.sma(df["close"], length=20)
        df["sma_50"] = ta.sma(df["close"], length=50)
        df["ema_21"] = ta.ema(df["close"], length=21)
    except Exception as e:
        logger.warning("pandas_ta failed: %s — using manual indicators", e)
        df = _manual_indicators(df)

    # Derived features
    df["ret_1d"] = df["close"].pct_change(1)
    df["ret_5d"] = df["close"].pct_change(5)
    df["ret_20d"] = df["close"].pct_change(20)
    df["vol_20d"] = df["ret_1d"].rolling(20).std() * np.sqrt(252)
    df["vol_ratio"] = df["vol_20d"] / (df["vol_20d"].rolling(60).mean() + 1e-8)
    df["obv_norm"] = df.get("obv", df["volume"].cumsum()) / (df.get("obv", df["volume"].cumsum()).abs().rolling(20).max() + 1e-8)
    sma20 = df.get("sma_20", df["close"].rolling(20).mean())
    sma50 = df.get("sma_50", df["close"].rolling(50).mean())
    df["sma_ratio_20"] = df["close"] / (sma20 + 1e-8) - 1
    df["sma_ratio_50"] = df["close"] / (sma50 + 1e-8) - 1

    # Fill missing with 0
    for col in FEATURE_COLS:
        if col not in df.columns:
            df[col] = 0.0
    df[FEATURE_COLS] = df[FEATURE_COLS].fillna(method="ffill").fillna(0.0)
    return df


def _manual_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Fallback: compute indicators manually if pandas_ta unavailable."""
    close = df["close"]
    # RSI
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / (loss + 1e-8)
    df["rsi_14"] = 100 - 100 / (1 + rs)
    df["rsi_21"] = df["rsi_14"]  # simplified
    # MACD
    ema12 = close.ewm(span=12).mean()
    ema26 = close.ewm(span=26).mean()
    df["macd"] = ema12 - ema26
    df["macd_signal"] = df["macd"].ewm(span=9).mean()
    df["macd_hist"] = df["macd"] - df["macd_signal"]
    # BB
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    df["bb_upper"] = sma20 + 2 * std20
    df["bb_lower"] = sma20 - 2 * std20
    df["bb_pct"] = (close - df["bb_lower"]) / (df["bb_upper"] - df["bb_lower"] + 1e-8)
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / (sma20 + 1e-8)
    # ATR
    hl = df["high"] - df["low"]
    hc = (df["high"] - close.shift()).abs()
    lc = (df["low"] - close.shift()).abs()
    tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    df["atr_14"] = tr.rolling(14).mean()
    # Simple stochastic
    low14 = df["low"].rolling(14).min()
    high14 = df["high"].rolling(14).max()
    df["stoch_k"] = 100 * (close - low14) / (high14 - low14 + 1e-8)
    df["stoch_d"] = df["stoch_k"].rolling(3).mean()
    # ADX (simplified)
    df["adx_14"] = tr.rolling(14).mean() / (close + 1e-8) * 100
    # CCI
    typical = (df["high"] + df["low"] + close) / 3
    df["cci_14"] = (typical - typical.rolling(14).mean()) / (0.015 * typical.rolling(14).std() + 1e-8)
    # Williams %R
    df["williams_r"] = -100 * (high14 - close) / (high14 - low14 + 1e-8)
    # MFI
    df["mfi_14"] = df["stoch_k"]  # simplified proxy
    # ROC
    df["roc_10"] = close.pct_change(10) * 100
    # SMA
    df["sma_20"] = sma20
    df["sma_50"] = close.rolling(50).mean()
    df["ema_21"] = close.ewm(span=21).mean()
    # OBV
    direction = np.sign(close.diff().fillna(0))
    df["obv"] = (direction * df["volume"]).cumsum()
    return df


def get_nifty_benchmark(period: str = "2y") -> pd.Series:
    """Fetch NIFTY 50 daily returns."""
    try:
        import yfinance as yf
        nifty = yf.download("^NSEI", period=period, auto_adjust=True, progress=False)
        if nifty is not None and len(nifty) > 0:
            nifty.columns = [c.lower() for c in nifty.columns]
            return nifty["close"].pct_change().dropna()
    except Exception as e:
        logger.warning("Failed to fetch NIFTY benchmark: %s", e)
    return pd.Series(dtype=float)


def get_india_vix() -> float:
    """Get latest India VIX value."""
    try:
        import yfinance as yf
        vix = yf.download("^INDIAVIX", period="5d", auto_adjust=True, progress=False)
        if vix is not None and len(vix) > 0:
            return float(vix["Close"].iloc[-1])
    except Exception as e:
        logger.warning("Failed to fetch India VIX: %s", e)
    return 15.0  # fallback


def prepare_feature_matrix(stock_data: dict[str, pd.DataFrame]) -> tuple[pd.DataFrame, pd.Series]:
    """
    Combine stock features into a single matrix for model inference.
    Returns (X: DataFrame[tickers x features], latest_prices: Series)
    """
    rows = []
    latest_prices = {}
    for ticker, df in stock_data.items():
        if len(df) < 1:
            continue
        row = df[FEATURE_COLS].iloc[-1].copy()
        row.name = ticker
        rows.append(row)
        latest_prices[ticker] = float(df["close"].iloc[-1])
    if not rows:
        return pd.DataFrame(), pd.Series(dtype=float)
    X = pd.DataFrame(rows)
    X = X.fillna(0.0)
    return X, pd.Series(latest_prices)
