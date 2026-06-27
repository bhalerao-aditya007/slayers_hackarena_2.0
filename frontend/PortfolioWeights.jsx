const PALETTE = [
  '#00D4A0','#F5A623','#7EB8D4','#a78bfa','#60a5fa',
  '#f97316','#ec4899','#84cc16','#22d3ee','#fb7185',
  '#4ade80','#fbbf24','#818cf8','#38bdf8','#f472b6',
]

function formatINR(v) {
  if (Math.abs(v) >= 1e7) return `₹${(v/1e7).toFixed(2)}Cr`
  if (Math.abs(v) >= 1e5) return `₹${(v/1e5).toFixed(2)}L`
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

function PieChart({ data }) {
  const cx = 70, cy = 70, r = 58, ir = 30
  let angle = -Math.PI / 2
  const total = data.reduce((a, d) => a + d.value, 0)

  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(angle + sweep)
    const y2 = cy + r * Math.sin(angle + sweep)
    const xi1 = cx + ir * Math.cos(angle)
    const yi1 = cy + ir * Math.sin(angle)
    const xi2 = cx + ir * Math.cos(angle + sweep)
    const yi2 = cy + ir * Math.sin(angle + sweep)
    const large = sweep > Math.PI ? 1 : 0
    const path = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${xi2.toFixed(2)} ${yi2.toFixed(2)}`,
      `A ${ir} ${ir} 0 ${large} 0 ${xi1.toFixed(2)} ${yi1.toFixed(2)}`,
      'Z',
    ].join(' ')
    angle += sweep
    return { ...d, path, color: PALETTE[i % PALETTE.length] }
  })

  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} opacity={0.9}
          stroke="var(--s1)" strokeWidth={1.5} />
      ))}
    </svg>
  )
}

export default function PortfolioWeights({ weights, commands, goal, large }) {
  const entries = Object.entries(weights)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  const pieData = entries.map(([k, v]) => ({
    name: k.replace('.NS', ''), value: v,
  }))

  const cap = goal.capital_inr

  return (
    <div className="card">
      <div className="section-label"><span>🥧</span> Portfolio weights</div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <PieChart data={pieData} />
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 140 }}>
          {entries.map(([t, w], i) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', fontSize: '0.78rem' }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: PALETTE[i % PALETTE.length],
                display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1, fontSize: '0.74rem' }}>
                {t.replace('.NS', '')}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                {(w * 100).toFixed(1)}%
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                {formatINR(w * cap)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Action</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {commands.slice(0, large ? 12 : 6).map(c => (
              <tr key={c.ticker}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem' }}>
                  {c.displayTicker || c.ticker.replace('.NS', '')}
                </td>
                <td>
                  <span className={`chip-${c.action.toLowerCase()}`}>{c.action}</span>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{c.quantity}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  {formatINR(c.amount_inr)}
                </td>
                <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 160 }}>
                  {c.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
