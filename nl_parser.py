"""NL Goal Parser — uses Anthropic API to extract structured InvestmentGoal from free text."""
from __future__ import annotations
import json
import logging
import re
from typing import Any

from quantis.config import groq_API_KEY
from quantis.api.schemas import InvestmentGoal, RiskTolerance

logger = logging.getLogger("quantis.nlparser")

_SYSTEM = """You are a financial NLP extractor for an Indian stock market platform.
Extract structured investment goal parameters from the user's text.
Always respond with ONLY valid JSON matching this schema — no markdown, no preamble:
{
  "return_target": <float 0.0–2.0, annual fraction e.g. 0.15 for 15%>,
  "max_drawdown": <float 0.0–0.99, fraction e.g. 0.10 for 10%>,
  "sectors_excluded": <list of strings from: Banking, IT, Energy, FMCG, Pharma, Auto, NBFC, Metals, Infra, Utilities, Telecom, Cement, Consumer, Insurance>,
  "capital_inr": <float, capital in INR — convert lakhs: 1 lakh = 100000>,
  "horizon_days": <int, trading days — 1 month ≈ 21, 1 year ≈ 252>,
  "risk_tolerance": <"conservative"|"moderate"|"aggressive">
}
Defaults if not mentioned: return_target=0.15, max_drawdown=0.10, sectors_excluded=[], capital_inr=500000, horizon_days=252, risk_tolerance="moderate"."""


def parse_nl_goal(nl_goal: str) -> InvestmentGoal:
    """Parse natural language investment goal into structured InvestmentGoal."""
    if not groq_API_KEY:
        logger.warning("No API_KEY — using rule-based fallback parser")
        return _rule_based_parse(nl_goal)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=groq_API_KEY)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=_SYSTEM,
            messages=[{"role": "user", "content": nl_goal}],
        )
        raw = resp.content[0].text.strip()
        # Strip markdown fences if any
        raw = re.sub(r"```[a-z]*\n?", "", raw).strip().strip("`")
        data = json.loads(raw)
        return _validate_goal(data)
    except Exception as e:
        logger.warning("Anthropic NL parse failed: %s — using rule-based fallback", e)
        return _rule_based_parse(nl_goal)


def _validate_goal(data: dict[str, Any]) -> InvestmentGoal:
    """Clamp and validate extracted fields."""
    rt = float(data.get("return_target", 0.15))
    if rt > 2.0:
        rt = rt / 100.0  # probably passed as percentage
    md = float(data.get("max_drawdown", 0.10))
    if md > 1.0:
        md = md / 100.0
    return InvestmentGoal(
        return_target=min(max(rt, 0.01), 2.0),
        max_drawdown=min(max(md, 0.01), 0.99),
        sectors_excluded=[str(s) for s in data.get("sectors_excluded", [])],
        capital_inr=max(float(data.get("capital_inr", 500000)), 10000),
        horizon_days=max(int(data.get("horizon_days", 252)), 5),
        risk_tolerance=RiskTolerance(data.get("risk_tolerance", "moderate")),
    )


def _rule_based_parse(text: str) -> InvestmentGoal:
    """Simple regex-based fallback parser."""
    text_lower = text.lower()

    # Return target
    m = re.search(r"(\d+(?:\.\d+)?)\s*%?\s*(?:annual|yearly|per year|return|returns)", text_lower)
    return_target = float(m.group(1)) / 100 if m else 0.15

    # Max drawdown
    m = re.search(r"(?:max|maximum|drawdown|dd)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%", text_lower)
    max_drawdown = float(m.group(1)) / 100 if m else 0.10

    # Capital
    m = re.search(r"₹?\s*(\d+(?:\.\d+)?)\s*(?:lakh|l\b|lac)", text_lower)
    if m:
        capital_inr = float(m.group(1)) * 100_000
    else:
        m = re.search(r"₹?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore)", text_lower)
        capital_inr = float(m.group(1)) * 10_000_000 if m else 500_000

    # Horizon
    m = re.search(r"(\d+)\s*(?:year|yr)", text_lower)
    if m:
        horizon_days = int(m.group(1)) * 252
    else:
        m = re.search(r"(\d+)\s*(?:month|mo)", text_lower)
        horizon_days = int(m.group(1)) * 21 if m else 252

    # Risk tolerance
    if any(w in text_lower for w in ["aggressive", "high risk", "maximum risk"]):
        risk = RiskTolerance.aggressive
    elif any(w in text_lower for w in ["conservative", "safe", "low risk", "minimal risk"]):
        risk = RiskTolerance.conservative
    else:
        risk = RiskTolerance.moderate

    # Sectors to exclude
    ALL_SECTORS = ["banking", "it", "energy", "fmcg", "pharma", "auto", "nbfc",
                   "metals", "infra", "utilities", "telecom", "cement", "consumer", "insurance"]
    sectors_excluded = []
    for s in ALL_SECTORS:
        if re.search(r"\b(?:no|avoid|exclude|without)\b.*\b" + s + r"\b", text_lower):
            sectors_excluded.append(s.title())

    return InvestmentGoal(
        return_target=min(return_target, 2.0),
        max_drawdown=min(max_drawdown, 0.99),
        sectors_excluded=sectors_excluded,
        capital_inr=capital_inr,
        horizon_days=horizon_days,
        risk_tolerance=risk,
    )
