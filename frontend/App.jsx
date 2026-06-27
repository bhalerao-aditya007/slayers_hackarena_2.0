import { useState, useEffect, useRef, useCallback } from 'react'
import Navbar from './components/Navbar'
import InputPage from './pages/InputPage'
import ResultsPage from './pages/ResultsPage'

// ── Mock pipeline engine ──────────────────────────────────────────────────────
const rnd = (lo, hi) => lo + Math.random() * (hi - lo)
const rndN = (lo, hi, d = 4) => +rnd(lo, hi).toFixed(d)

const NIFTY_TICKERS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK',
  'HINDUNILVR','ITC','SBIN','BHARTIARTL','KOTAKBANK',
  'LT','AXISBANK','BAJFINANCE','ASIANPAINT','MARUTI',
  'TITAN','SUNPHARMA','ULTRACEMCO','WIPRO','NTPC',
  'ONGC','POWERGRID','HCLTECH','BAJAJFINSV','COALINDIA',
]
const SECTOR_MAP = {
  RELIANCE:'Energy',TCS:'IT',HDFCBANK:'Banking',INFY:'IT',ICICIBANK:'Banking',
  HINDUNILVR:'FMCG',ITC:'FMCG',SBIN:'Banking',BHARTIARTL:'Telecom',KOTAKBANK:'Banking',
  LT:'Infra',AXISBANK:'Banking',BAJFINANCE:'NBFC',ASIANPAINT:'Consumer',MARUTI:'Auto',
  TITAN:'Consumer',SUNPHARMA:'Pharma',ULTRACEMCO:'Cement',WIPRO:'IT',NTPC:'Utilities',
  ONGC:'Energy',POWERGRID:'Utilities',HCLTECH:'IT',BAJAJFINSV:'NBFC',COALINDIA:'Metals',
}

function buildMockResult(goal) {
  const regime = ['bull','bull','ranging','bear'][Math.floor(Math.random()*4)] || 'bull'
  const kellyMap = { bull:1.0, ranging:0.5, bear:0.25, high_vol:0.0 }
  const tickers = NIFTY_TICKERS.slice(0, 18)

  const signals = tickers.map(t => {
    const ka = rndN(-0.035, 0.085)
    const la = rndN(-0.028, 0.075)
    const pa = rndN(-0.022, 0.065)
    const ia = rndN(-0.025, 0.070)
    const final = 0.20*ka + 0.40*la + 0.25*pa + 0.15*ia
    return {
      ticker: t + '.NS',
      displayTicker: t,
      sector: SECTOR_MAP[t] || 'Other',
      kan_alpha: ka, lgbm_alpha: la, patchtst_alpha: pa, il_alpha: ia,
      final_alpha: +final.toFixed(6),
      shap_data: {
        rsi_14: rndN(-0.02, 0.03), macd_hist: rndN(-0.015, 0.025),
        mamba_enc: rndN(-0.01, 0.02), bb_pct: rndN(-0.01, 0.015),
        roc_10: rndN(-0.008, 0.012), adx_14: rndN(-0.005, 0.010),
        vol_ratio: rndN(-0.006, 0.009), sma_ratio_20: rndN(-0.005, 0.008),
        stoch_k: rndN(-0.004, 0.007), mfi_14: rndN(-0.003, 0.005),
      },
      gate_active: regime !== 'high_vol',
    }
  }).sort((a, b) => b.final_alpha - a.final_alpha)

  const top = signals.slice(0, 12).filter(s => s.final_alpha > 0)
  const rawW = top.map(s => Math.max(0, s.final_alpha))
  const wSum = rawW.reduce((a,b) => a+b, 0) || 1
  const weights = {}
  top.forEach((s, i) => {
    weights[s.ticker] = +Math.min(0.20, (rawW[i]/wSum) * (kellyMap[regime] || 0.5)).toFixed(4)
  })
  const totalW = Object.values(weights).reduce((a,b)=>a+b,0) || 1
  Object.keys(weights).forEach(k => weights[k] = +(weights[k]/totalW).toFixed(4))

  const cap = goal.capital_inr || 500000
  const horizon = goal.horizon_days || 252
  const mu = regime === 'bull' ? 0.0008 : regime === 'bear' ? -0.0003 : 0.0004
  const sigma = regime === 'high_vol' ? 0.018 : regime === 'bear' ? 0.014 : 0.011

  const p5  = Array.from({length:horizon}, (_,i) => Math.round(cap*(1 + (mu-1.65*sigma)*i/horizon*horizon + rnd(-0.05,0.02)*i/horizon)))
  const p50 = Array.from({length:horizon}, (_,i) => Math.round(cap*Math.exp(mu*i)))
  const p95 = Array.from({length:horizon}, (_,i) => Math.round(cap*(1 + (mu+1.65*sigma)*i/horizon*horizon + rnd(0,0.06)*i/horizon)))

  const annRet = mu * 252
  const annVol = sigma * Math.sqrt(252)
  const sharpe = (annRet - 0.071) / annVol
  const mdd = -(sigma * 3.5 + rnd(0.02, 0.06))

  const periods = [2022,2023,2024].map(y => {
    const sr = rndN(0.09, 0.22, 4), nr = rndN(0.07, 0.18, 4)
    return {
      start:`${y}-01-01`, end:`${y}-12-31`,
      strategy_return:sr, nifty_return:nr, alpha:+(sr-nr).toFixed(4),
      sharpe:rndN(0.9,1.9,3), sortino:rndN(1.1,2.4,3), calmar:rndN(0.6,1.8,3),
      max_drawdown:rndN(-0.16,-0.07,4), hit_rate:rndN(0.52,0.67,3), ic:rndN(0.04,0.11,4),
    }
  })

  const modelIc = rndN(0.04, 0.09, 4)

  return {
    regime: {
      state: regime,
      confidence: rndN(0.72, 0.95, 3),
      kelly_factor: kellyMap[regime] || 0.5,
      model_ic: modelIc,
      gate_status: modelIc < 0.02 ? 'degraded' : 'active',
      transition_prob: regime === 'bull' ? [0.88,0.05,0.04,0.03]
                     : regime === 'bear' ? [0.04,0.86,0.06,0.04]
                     : [0.12,0.08,0.05,0.75],
    },
    goal: {
      return_target: goal.return_target || 0.15,
      max_drawdown: goal.max_drawdown || 0.10,
      sectors_excluded: goal.sectors_excluded || [],
      capital_inr: cap,
      horizon_days: horizon,
      risk_tolerance: goal.risk_tolerance || 'moderate',
    },
    signals,
    weights,
    commands: top.slice(0,10).map(s => ({
      ticker: s.ticker,
      displayTicker: s.displayTicker,
      action: s.final_alpha > 0.04 ? 'BUY' : s.final_alpha > 0.01 ? 'HOLD' : 'SELL',
      quantity: Math.max(1, Math.floor((weights[s.ticker]||0)*cap / rnd(400,3200))),
      amount_inr: +((weights[s.ticker]||0)*cap).toFixed(0),
      lot_compliant: true,
      reason: `MoE α: ${s.final_alpha >= 0 ? '+' : ''}${(s.final_alpha*100).toFixed(2)}% | Target weight: ${((weights[s.ticker]||0)*100).toFixed(1)}%`,
    })),
    risk: {
      var_95: +(-1.645*sigma).toFixed(6),
      var_99: +(-2.326*sigma).toFixed(6),
      cvar_95: +(-1.96*sigma).toFixed(6),
      cvar_99: +(-2.576*sigma).toFixed(6),
      max_drawdown: +mdd.toFixed(4),
      portfolio_volatility: +annVol.toFixed(4),
      portfolio_return_expected: +annRet.toFixed(4),
      sharpe_ratio: +sharpe.toFixed(3),
      sortino_ratio: +(sharpe * 1.4).toFixed(3),
      calmar_ratio: +(annRet / Math.abs(mdd)).toFixed(3),
      mc_percentile_5: p5,
      mc_percentile_50: p50,
      mc_percentile_95: p95,
      mc_horizon_days: horizon,
    },
    backtest: {
      periods,
      summary_sharpe: rndN(1.1, 1.7, 3),
      summary_calmar: rndN(0.9, 1.6, 3),
      summary_alpha: rndN(0.03, 0.08, 4),
      summary_max_drawdown: rndN(-0.14, -0.08, 4),
      ic_ir: rndN(0.55, 0.88, 3),
    },
  }
}

const PIPELINE_STEPS = [
  'NL Parser', 'Market Data', 'Mamba Encoder',
  'KAN Alpha', 'LightGBM Alpha', 'PatchTST',
  'HMM Regime', 'MoE Gating', 'CVaR Optimizer',
  'Monte Carlo', 'Walk-Forward BT',
]

export default function App() {
  const [view, setView] = useState('input')
  const [result, setResult] = useState(null)
  const [job, setJob] = useState({ status: 'idle', progress: 0, message: '', error: '' })
  const [nlGoal, setNlGoal] = useState('')
  const [formGoal, setFormGoal] = useState({
    return_target: 15, max_drawdown: 10, horizon_months: 12,
    risk_tolerance: 'moderate', capital_inr: 500000, sectors_excluded: [],
  })
  const [niftyLevel, setNiftyLevel] = useState(24316 + rnd(-100, 100))
  const [indiaVix, setIndiaVix] = useState(13.8 + rnd(-1, 2))
  const [agentMessages, setAgentMessages] = useState([])
  const timerRef = useRef(null)

  // Simulate live NIFTY ticker
  useEffect(() => {
    const iv = setInterval(() => {
      setNiftyLevel(v => +(v + rnd(-35, 35)).toFixed(2))
      setIndiaVix(v => +Math.max(9, Math.min(30, v + rnd(-0.3, 0.3))).toFixed(2))
    }, 8000)
    return () => clearInterval(iv)
  }, [])

  const pushMsg = useCallback((type, model, message, value) => {
    setAgentMessages(prev => [{
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toLocaleTimeString(),
      type, model, message, value,
    }, ...prev].slice(0, 200))
  }, [])

  const runAnalysis = useCallback(async (goal) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setJob({ status: 'running', progress: 0, message: 'Initialising pipeline...', error: '' })
    pushMsg('info', 'System', 'Pipeline started — parsing natural language goal...')

    let step = 0
    timerRef.current = setInterval(() => {
      if (step >= PIPELINE_STEPS.length) {
        clearInterval(timerRef.current)
        const r = buildMockResult(goal)
        setResult(r)
        setJob({ status: 'done', progress: 100, message: 'Analysis complete', error: '' })
        setView('results')
        pushMsg('regime', 'HMM Detector', `Regime detected → ${r.regime.state.toUpperCase()} (${(r.regime.confidence*100).toFixed(1)}% confidence)`)
        pushMsg('gate', 'Efficacy Monitor', `Model IC: ${r.regime.model_ic.toFixed(4)} — Gate ${r.regime.gate_status.toUpperCase()}`, r.regime.model_ic)
        pushMsg('signal', 'MoE Gating', `Portfolio optimised with Kelly factor ${r.regime.kelly_factor}×`)
        return
      }
      const pct = Math.round(((step + 1) / PIPELINE_STEPS.length) * 96)
      setJob({ status: 'running', progress: pct, message: PIPELINE_STEPS[step] + '…', error: '' })
      pushMsg('info', PIPELINE_STEPS[step], `Processing ${PIPELINE_STEPS[step]}...`)
      step++
    }, 700)
  }, [pushMsg])

  return (
    <div style={{ background: 'var(--ink)', minHeight: '100vh' }}>
      <Navbar
        view={view} setView={setView}
        result={result} job={job}
        niftyLevel={niftyLevel} indiaVix={indiaVix}
      />
      <div style={{ padding: '0 24px 60px' }}>
        {view === 'input' ? (
          <InputPage
            nlGoal={nlGoal} setNlGoal={setNlGoal}
            formGoal={formGoal} setFormGoal={setFormGoal}
            job={job} runAnalysis={runAnalysis}
            pipelineSteps={PIPELINE_STEPS}
          />
        ) : (
          <ResultsPage
            result={result}
            agentMessages={agentMessages}
            onBack={() => setView('input')}
          />
        )}
      </div>
    </div>
  )
}
