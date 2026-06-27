"""HMM Regime Detector — loads pretrained hmm_regime.pkl or trains fresh."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from quantis.config import MODELS_DIR, KELLY_REGIME_FACTORS, HMM_N_COMPONENTS, HMM_N_ITER, HMM_N_INIT
from quantis.api.schemas import RegimeState, RegimeName, GateStatus

logger = logging.getLogger("quantis.hmm")

MODEL_PATH = MODELS_DIR / "hmm_regime.pkl"

# State labels — ordered to match typical HMM fit output
# We post-hoc label by mean return: highest=bull, lowest=bear, highest_vol=high_vol, else=ranging
STATE_LABELS = ["bull", "bear", "high_vol", "ranging"]


class RegimeDetector:
    def __init__(self):
        self.model = None
        self.scaler = None
        self._label_map: dict[int, str] = {}
        self._load_or_init()

    def _load_or_init(self):
        """Try to load saved model; if not found, prepare for training."""
        import joblib
        if MODEL_PATH.exists():
            try:
                saved = joblib.load(MODEL_PATH)
                if isinstance(saved, dict):
                    self.model = saved.get("model")
                    self.scaler = saved.get("scaler")
                    self._label_map = saved.get("label_map", {})
                else:
                    # Might just be the HMM model itself
                    self.model = saved
                logger.info("Loaded HMM regime model from %s", MODEL_PATH)
                return
            except Exception as e:
                logger.warning("Failed to load HMM model: %s — will train fresh", e)

        logger.info("No pretrained HMM found — will train on first data fetch")

    def _build_features(self, nifty_returns: pd.Series, india_vix: float = 15.0) -> np.ndarray:
        """Build 4-dim regime feature matrix from NIFTY returns + VIX."""
        r = nifty_returns.dropna()
        if len(r) < 25:
            return np.array([[0.0, 0.15, 0.5, 0.0]])

        # Rolling 20-day windows
        roll_ret = r.rolling(20).mean() * 252  # annualised
        roll_vol = r.rolling(20).std() * np.sqrt(252)  # annualised
        # VIX percentile rank (use returns vol as proxy if VIX series not full)
        vix_pct = float(np.percentile(roll_vol.dropna(), 70))  # simplified scalar
        vix_z = (india_vix - 15.0) / 5.0  # z-score around typical 15

        X = pd.DataFrame({
            "roll_ret": roll_ret,
            "roll_vol": roll_vol,
            "vix_pct": vix_pct,
            "vix_z": vix_z,
        }).dropna().values
        return X

    def fit(self, nifty_returns: pd.Series, india_vix: float = 15.0):
        """Train HMM on historical NIFTY data."""
        from hmmlearn import hmm
        from sklearn.preprocessing import StandardScaler
        import joblib

        X = self._build_features(nifty_returns, india_vix)
        if len(X) < HMM_N_COMPONENTS * 5:
            logger.warning("Insufficient data for HMM training (%d rows)", len(X))
            return

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        best_model, best_score = None, -np.inf
        for _ in range(HMM_N_INIT):
            try:
                model = hmm.GaussianHMM(
                    n_components=HMM_N_COMPONENTS,
                    covariance_type="diag",
                    n_iter=HMM_N_ITER,
                    random_state=np.random.randint(0, 9999),
                )
                model.fit(X_scaled)
                score = model.score(X_scaled)
                if score > best_score:
                    best_score = score
                    best_model = model
            except Exception as e:
                logger.debug("HMM init failed: %s", e)

        if best_model is None:
            logger.error("HMM training failed completely")
            return

        self.model = best_model
        # Label states by mean return (highest = bull, lowest = bear, etc.)
        means = best_model.means_[:, 0]  # first feature = return
        order = np.argsort(means)[::-1]  # descending: bull, ..., bear
        self._label_map = {}
        labels_assigned = []
        for rank, state_idx in enumerate(order):
            vol = best_model.means_[state_idx, 1] if best_model.means_.shape[1] > 1 else 0
            if rank == 0:
                lbl = "bull"
            elif rank == len(order) - 1:
                lbl = "bear"
            elif vol > np.mean(best_model.means_[:, 1]) if best_model.means_.shape[1] > 1 else False:
                lbl = "high_vol"
            else:
                lbl = "ranging"
            self._label_map[state_idx] = lbl

        # Save
        try:
            MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump({"model": self.model, "scaler": self.scaler, "label_map": self._label_map}, MODEL_PATH)
            logger.info("HMM model saved to %s", MODEL_PATH)
        except Exception as e:
            logger.warning("Failed to save HMM model: %s", e)

    def detect(self, nifty_returns: pd.Series, india_vix: float = 15.0,
               model_ic: float = 0.05) -> RegimeState:
        """
        Detect current market regime.
        Returns RegimeState with state, confidence, kelly_factor, gate_status.
        """
        if self.model is None or self.scaler is None:
            logger.info("Training HMM regime detector...")
            self.fit(nifty_returns, india_vix)

        if self.model is None:
            return _fallback_regime(nifty_returns, model_ic)

        try:
            X = self._build_features(nifty_returns, india_vix)
            X_scaled = self.scaler.transform(X)
            # Predict on last observation
            state_seq = self.model.predict(X_scaled)
            current_state = int(state_seq[-1])

            # Posterior probabilities for last step
            log_probs = self.model.predict_proba(X_scaled)
            probs = log_probs[-1]  # shape (n_components,)

            state_label = self._label_map.get(current_state, "ranging")
            confidence = float(probs[current_state])

            # Transition probabilities from current state
            trans_row = self.model.transmat_[current_state].tolist()
            # Reorder to [bull, bear, high_vol, ranging] based on label_map
            ordered_probs = _reorder_probs(trans_row, self._label_map)

            kelly = KELLY_REGIME_FACTORS.get(state_label, 0.5)
            gate = _compute_gate_status(model_ic)

            return RegimeState(
                state=RegimeName(state_label),
                confidence=confidence,
                kelly_factor=kelly,
                model_ic=model_ic,
                gate_status=gate,
                transition_prob=ordered_probs,
            )
        except Exception as e:
            logger.warning("HMM detection failed: %s — using fallback", e)
            return _fallback_regime(nifty_returns, model_ic)


def _reorder_probs(trans_row: list[float], label_map: dict[int, str]) -> list[float]:
    """Reorder transition probs to [bull, bear, high_vol, ranging] order."""
    order = ["bull", "bear", "high_vol", "ranging"]
    inv = {v: k for k, v in label_map.items()}
    result = []
    for lbl in order:
        idx = inv.get(lbl)
        result.append(float(trans_row[idx]) if idx is not None and idx < len(trans_row) else 0.0)
    total = sum(result) or 1.0
    return [r / total for r in result]


def _compute_gate_status(model_ic: float) -> GateStatus:
    if model_ic < 0.0:
        return GateStatus.blocked
    elif model_ic < 0.02:
        return GateStatus.degraded
    return GateStatus.active


def _fallback_regime(nifty_returns: pd.Series, model_ic: float) -> RegimeState:
    """Simple rule-based regime when HMM is unavailable."""
    r = nifty_returns.dropna()
    if len(r) < 20:
        state, confidence = "ranging", 0.60
    else:
        ret_20 = float(r.tail(20).mean() * 252)
        vol_20 = float(r.tail(20).std() * np.sqrt(252))
        if vol_20 > 0.30:
            state, confidence = "high_vol", 0.70
        elif ret_20 > 0.10:
            state, confidence = "bull", 0.75
        elif ret_20 < -0.05:
            state, confidence = "bear", 0.70
        else:
            state, confidence = "ranging", 0.65

    kelly = KELLY_REGIME_FACTORS.get(state, 0.5)
    gate = _compute_gate_status(model_ic)
    return RegimeState(
        state=RegimeName(state),
        confidence=confidence,
        kelly_factor=kelly,
        model_ic=model_ic,
        gate_status=gate,
        transition_prob=[0.80, 0.05, 0.05, 0.10] if state == "bull"
                        else [0.05, 0.80, 0.05, 0.10] if state == "bear"
                        else [0.05, 0.10, 0.75, 0.10] if state == "high_vol"
                        else [0.15, 0.10, 0.05, 0.70],
    )


# Module-level singleton
_detector: Optional[RegimeDetector] = None


def get_regime_detector() -> RegimeDetector:
    global _detector
    if _detector is None:
        _detector = RegimeDetector()
    return _detector
