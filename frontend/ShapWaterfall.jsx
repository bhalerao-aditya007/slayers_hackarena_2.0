export default function ShapWaterfall({ signal, onClose }) {
  if (!signal) return null

  const entries = Object.entries(signal.shap_data)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 8)

  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.001)
  const barW = 200

  return (
    <div className="card fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="section-label" style={{ marginBottom: 0, flex: 1 }}>
          <span>🔬</span> SHAP — {signal.displayTicker || signal.ticker.replace('.NS', '')}
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }}>✕</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Final MoE α: </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem',
          color: signal.final_alpha >= 0 ? 'var(--bull)' : 'var(--bear)',
        }}>
          {signal.final_alpha >= 0 ? '+' : ''}{(signal.final_alpha * 100).toFixed(2)}%
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(([feature, value]) => {
          const pct = Math.abs(value) / maxAbs
          const isPos = value >= 0
          return (
            <div key={feature}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                justifyContent: 'space-between', marginBottom: 4,
              }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flex: 1 }}>
                  {feature.replace(/_/g, ' ')}
                </span>
                <span style={{
                  fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: isPos ? 'var(--bull)' : 'var(--bear)',
                  minWidth: 60, textAlign: 'right',
                }}>
                  {isPos ? '+' : ''}{(value * 100).toFixed(3)}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct * 100}%`,
                  background: isPos
                    ? 'linear-gradient(90deg, var(--bull), rgba(0,212,160,0.6))'
                    : 'linear-gradient(90deg, var(--bear), rgba(255,77,106,0.6))',
                  borderRadius: 3,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--s2)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <span style={{ color: 'var(--bull)' }}>■</span> Positive = pushes alpha up &nbsp;
        <span style={{ color: 'var(--bear)' }}>■</span> Negative = drags alpha down
        <br />LightGBM TreeExplainer · Top 8 features
      </div>
    </div>
  )
}
