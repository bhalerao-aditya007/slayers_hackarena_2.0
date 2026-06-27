import { useState } from 'react'

const SECTORS = [
  'Banking','IT','Energy','FMCG','Pharma','Auto',
  'NBFC','Metals','Infra','Utilities','Telecom',
  'Cement','Consumer','Healthcare',
]

const EXAMPLES = [
  { label: 'Aggressive growth', text: 'I want 15% annual returns with max 10% drawdown. ₹5 lakhs capital, 1 year. Aggressive. Avoid pharma and FMCG.' },
  { label: 'Conservative income', text: 'Steady 10% returns over 2 years, ₹10 lakhs, conservative, max 8% drawdown. Exclude cyclical sectors.' },
  { label: 'NIFTY beater', text: 'Beat NIFTY by 5% with moderate risk. ₹3 lakh corpus, 18 months horizon. Exclude PSU banking.' },
]

const DEMO_SCENARIOS = [
  {
    label: '🐂 Bull Market',
    desc: 'High returns, full Kelly, IT + Banking',
    goal: { return_target:18, max_drawdown:12, horizon_months:12, risk_tolerance:'aggressive', capital_inr:500000, sectors_excluded:['Pharma','FMCG'] },
  },
  {
    label: '🛡️ Conservative',
    desc: 'Low drawdown, FMCG + Pharma defensive',
    goal: { return_target:10, max_drawdown:8, horizon_months:18, risk_tolerance:'conservative', capital_inr:1000000, sectors_excluded:['IT','Metals','Auto'] },
  },
  {
    label: '📉 Bear/Crisis',
    desc: 'High VIX, zero Kelly, gate blocks',
    goal: { return_target:8, max_drawdown:6, horizon_months:6, risk_tolerance:'conservative', capital_inr:300000, sectors_excluded:['Energy','Metals','Auto','Telecom'] },
  },
]

export default function InputPage({ nlGoal, setNlGoal, formGoal, setFormGoal, job, runAnalysis, pipelineSteps }) {
  const [err, setErr] = useState('')

  const isRunning = job.status === 'running'

  const handleRun = () => {
    if (!nlGoal.trim() && !formGoal.capital_inr) {
      setErr('Please describe your investment goal above.')
      return
    }
    setErr('')
    const goal = {
      return_target: formGoal.return_target / 100,
      max_drawdown: formGoal.max_drawdown / 100,
      horizon_days: Math.round(formGoal.horizon_months * 21),
      risk_tolerance: formGoal.risk_tolerance,
      capital_inr: formGoal.capital_inr,
      sectors_excluded: formGoal.sectors_excluded,
    }
    runAnalysis(goal)
  }

  const applyDemo = (scenario) => {
    setFormGoal(scenario.goal)
    setNlGoal('')
  }

  const toggleSector = (s) => {
    setFormGoal(f => ({
      ...f,
      sectors_excluded: f.sectors_excluded.includes(s)
        ? f.sectors_excluded.filter(x => x !== s)
        : [...f.sectors_excluded, s],
    }))
  }

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', paddingTop: 36 }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '2.2rem',
          fontWeight: 400, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.2,
        }}>
          <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Regime-aware</span> portfolio intelligence
          <br />for Indian retail investors
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 520, lineHeight: 1.7 }}>
          State your goal in plain English or use the structured form. The pipeline runs KAN + LightGBM + PatchTST
          under HMM regime gating — SEBI-compliant, NSE-native.
        </p>

        {/* USPs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
          {[
            { icon: '🧠', text: 'Mixture-of-Experts gating' },
            { icon: '🔒', text: 'Model efficacy IC monitor' },
            { icon: '🇮🇳', text: 'SEBI F&O lot constraints' },
            { icon: '📊', text: '10,000-path Monte Carlo' },
          ].map(u => (
            <span key={u.text} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--s1)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '4px 12px',
              fontSize: '0.76rem', color: 'var(--text-secondary)',
            }}>
              <span>{u.icon}</span>{u.text}
            </span>
          ))}
        </div>
      </div>

      {/* Demo scenarios */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-label">
          <span>⚡</span> Quick demo scenarios
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {DEMO_SCENARIOS.map(s => (
            <button key={s.label} onClick={() => applyDemo(s)} disabled={isRunning}
              style={{
                background: 'var(--s1)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.15s',
                opacity: isRunning ? 0.5 : 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--s2)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--s1)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* NL Goal */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">
          <span>💬</span> Natural language goal (optional)
        </div>
        <textarea className="input textarea"
          placeholder={'E.g. "I want 15% annual returns, max 10% drawdown, ₹5 lakhs, 1 year, aggressive. Avoid pharma."'}
          value={nlGoal}
          onChange={e => setNlGoal(e.target.value)}
          disabled={isRunning}
          style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.7 }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Examples:</span>
          {EXAMPLES.map(e => (
            <button key={e.label} onClick={() => setNlGoal(e.text)} disabled={isRunning}
              style={{
                background: 'var(--s2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                fontSize: '0.74rem', color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
              }}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Structured form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">
          <span>🎯</span> Investment parameters
        </div>

        <div className="g3" style={{ marginBottom: 18 }}>
          {[
            { key: 'return_target', label: 'Target return (%/yr)', min: 1, max: 60, step: 1, suffix: '%' },
            { key: 'max_drawdown', label: 'Max drawdown (%)', min: 1, max: 50, step: 1, suffix: '%' },
            { key: 'horizon_months', label: 'Horizon (months)', min: 1, max: 60, step: 1, suffix: 'mo' },
          ].map(({ key, label, min, max, step, suffix }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={min} max={max} step={step}
                  value={formGoal[key]}
                  onChange={e => setFormGoal(f => ({ ...f, [key]: +e.target.value }))}
                  disabled={isRunning}
                  style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.88rem',
                  color: 'var(--accent)', minWidth: 40, textAlign: 'right', fontWeight: 600,
                }}>
                  {formGoal[key]}{suffix}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="g2" style={{ marginBottom: 18 }}>
          <div>
            <label className="label">Capital (₹)</label>
            <input className="input" type="number" min={10000}
              value={formGoal.capital_inr}
              onChange={e => setFormGoal(f => ({ ...f, capital_inr: +e.target.value }))}
              disabled={isRunning}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label className="label">Risk tolerance</label>
            <select className="input" value={formGoal.risk_tolerance}
              onChange={e => setFormGoal(f => ({ ...f, risk_tolerance: e.target.value }))}
              disabled={isRunning}>
              <option value="conservative">Conservative (λ = 5.0)</option>
              <option value="moderate">Moderate (λ = 2.0)</option>
              <option value="aggressive">Aggressive (λ = 0.5)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" style={{ marginBottom: 8 }}>Exclude sectors</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {SECTORS.map(s => {
              const active = formGoal.sectors_excluded.includes(s)
              return (
                <button key={s} onClick={() => toggleSector(s)} disabled={isRunning}
                  style={{
                    padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                    fontSize: '0.78rem', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                    background: active ? 'rgba(255,77,106,0.12)' : 'var(--s2)',
                    border: `1px solid ${active ? 'rgba(255,77,106,0.4)' : 'var(--border)'}`,
                    color: active ? 'var(--bear)' : 'var(--text-secondary)',
                  }}>
                  {active ? '✕ ' : ''}{s}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div style={{
          background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)',
          borderRadius: 8, padding: '9px 14px', marginBottom: 14,
          color: 'var(--bear)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 7,
        }}>
          ⚠ {err}
        </div>
      )}

      {/* Pipeline progress */}
      {isRunning && (
        <div className="card-sm fade-in" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{job.message}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '0.83rem', fontWeight: 600 }}>
              {job.progress}%
            </span>
          </div>
          <div className="progress-track" style={{ marginBottom: 12 }}>
            <div className="progress-fill" style={{ width: `${job.progress}%` }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {pipelineSteps.map((step, i) => {
              const threshold = Math.round(((i + 1) / pipelineSteps.length) * 96)
              const done = job.progress >= threshold
              const active = job.progress >= threshold - 9 && !done
              return (
                <span key={step} style={{
                  fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                  background: done ? 'rgba(0,212,160,0.12)' : active ? 'rgba(245,166,35,0.12)' : 'var(--s3)',
                  color: done ? 'var(--bull)' : active ? 'var(--accent)' : 'var(--text-muted)',
                  border: `1px solid ${done ? 'rgba(0,212,160,0.2)' : active ? 'rgba(245,166,35,0.2)' : 'transparent'}`,
                  transition: 'all 0.3s',
                }}>
                  {done ? '✓ ' : active ? '⟳ ' : ''}{step}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="btn btn-primary" onClick={handleRun} disabled={isRunning}
          style={{ minWidth: 220, justifyContent: 'center', fontSize: '0.92rem', padding: '12px 24px' }}>
          {isRunning
            ? <><span className="spin">⟳</span> Analysing…</>
            : <><span>⚡</span> Run QUANTIS Analysis</>
          }
        </button>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          SEBI-compliant · NSE/BSE · Mean-CVaR optimised<br />
          HMM regime detection · 10K Monte Carlo paths
        </div>
      </div>
    </div>
  )
}
