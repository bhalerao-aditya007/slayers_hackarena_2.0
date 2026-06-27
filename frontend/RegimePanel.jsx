const CFG = {
  bull:     { label: 'BULL TRENDING',   color: 'var(--bull)',    dim: 'rgba(0,212,160,0.08)',    icon: '📈', kelly: 'Full Kelly (1.0×)',     desc: 'High returns, low vol. All experts active. Momentum models dominate.' },
  bear:     { label: 'BEAR TRENDING',   color: 'var(--bear)',    dim: 'rgba(255,77,106,0.08)',   icon: '📉', kelly: 'Quarter Kelly (0.25×)',  desc: 'Negative returns, rising vol. Defensive mode. PatchTST leads.' },
  high_vol: { label: 'HIGH VOLATILITY', color: 'var(--hv)',      dim: 'rgba(255,140,66,0.08)',   icon: '⚡', kelly: 'Zero Kelly (0.0×)',      desc: 'Extreme volatility. All new positions blocked. Cash or hedges.' },
  ranging:  { label: 'RANGING',         color: 'var(--ranging)', dim: 'rgba(123,164,192,0.08)',  icon: '↔', kelly: 'Half Kelly (0.5×)',      desc: 'Near-zero returns. Mean-reversion experts upweighted.' },
}
const GATE = {
  active:   { label: 'GATE ACTIVE',   cls: 'badge-active' },
  degraded: { label: 'GATE DEGRADED', cls: 'badge-degraded' },
  blocked:  { label: 'GATE BLOCKED',  cls: 'badge-blocked' },
}

export default function RegimePanel({ regime }) {
  const cfg = CFG[regime.state] || CFG.ranging
  const gate = GATE[regime.gate_status] || GATE.active

  return (
    <div className="card" style={{
      background: `linear-gradient(145deg, var(--s1) 0%, ${cfg.dim} 100%)`,
      border: `1px solid ${cfg.color}30`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background watermark */}
      <div style={{
        position: 'absolute', right: 10, top: 8,
        fontSize: '5rem', opacity: 0.05, userSelect: 'none', lineHeight: 1,
      }}>{cfg.icon}</div>

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
          HMM REGIME DETECTOR
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            width: 11, height: 11, borderRadius: '50%',
            background: cfg.color, display: 'inline-block',
            boxShadow: `0 0 12px ${cfg.color}80`,
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: cfg.color, letterSpacing: '0.03em' }}>
            {cfg.label}
          </span>
        </div>

        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          {cfg.desc}
        </p>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'CONFIDENCE', value: (regime.confidence * 100).toFixed(1) + '%', color: cfg.color },
            { label: 'MODEL IC', value: regime.model_ic.toFixed(4), color: regime.model_ic > 0.05 ? 'var(--bull)' : regime.model_ic > 0.02 ? 'var(--accent)' : 'var(--bear)' },
          ].map(m => (
            <div key={m.label}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 3 }}>KELLY SIZING</div>
          <div style={{ fontSize: '0.82rem', color: cfg.color, fontWeight: 600 }}>{cfg.kelly}</div>
        </div>

        {/* Transition probs */}
        {regime.transition_prob?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 7 }}>TRANSITION PROBS</div>
            {['Bull','Bear','HighVol','Ranging'].map((lbl, i) => {
              const p = regime.transition_prob[i] || 0
              const colors = ['var(--bull)','var(--bear)','var(--hv)','var(--ranging)']
              return (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: 48, fontFamily: 'var(--font-mono)' }}>{lbl}</span>
                  <div style={{ flex: 1, height: 3, background: 'var(--s3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${p * 100}%`, height: '100%', background: colors[i], borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: colors[i], width: 36, textAlign: 'right' }}>
                    {(p * 100).toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <span className={`badge ${gate.cls}`} style={{ fontSize: '0.68rem' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {gate.label}
        </span>
      </div>
    </div>
  )
}
