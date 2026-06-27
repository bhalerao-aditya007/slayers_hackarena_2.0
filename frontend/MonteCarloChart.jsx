import { useState } from 'react'

function formatINR(v) {
  if (Math.abs(v) >= 1e7) return `₹${(v/1e7).toFixed(2)}Cr`
  if (Math.abs(v) >= 1e5) return `₹${(v/1e5).toFixed(2)}L`
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

function buildPath(data, minV, maxV, w, h, sample = 60) {
  const step = Math.max(1, Math.floor(data.length / sample))
  const pts = []
  for (let i = 0; i < data.length; i += step) {
    const x = (i / (data.length - 1)) * w
    const y = h - ((data[i] - minV) / (maxV - minV || 1)) * h
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

export default function MonteCarloChart({ risk, large }) {
  const [hovered, setHovered] = useState(null)
  const W = 520, H = large ? 280 : 220
  const PAD = { t: 12, r: 10, b: 30, l: 60 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b

  const allVals = [...risk.mc_percentile_5, ...risk.mc_percentile_95]
  const minV = Math.min(...allVals) * 0.97
  const maxV = Math.max(...allVals) * 1.01

  const p5  = buildPath(risk.mc_percentile_5,  minV, maxV, cW, cH)
  const p50 = buildPath(risk.mc_percentile_50, minV, maxV, cW, cH)
  const p95 = buildPath(risk.mc_percentile_95, minV, maxV, cW, cH)

  // Area between p5 and p95
  const areaTop = risk.mc_percentile_95
  const areaBot = [...risk.mc_percentile_5].reverse()
  const n95 = areaTop.length, n5 = risk.mc_percentile_5.length
  const step95 = Math.max(1, Math.floor(n95 / 50))
  const step5  = Math.max(1, Math.floor(n5  / 50))
  const topPts = areaTop.filter((_,i) => i % step95 === 0)
  const botPts = areaBot.filter((_,i) => i % step5 === 0)
  const areaPathD = [
    ...topPts.map((v,i) => {
      const x = (i/(topPts.length-1))*cW; const y = cH - ((v-minV)/(maxV-minV||1))*cH
      return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }),
    ...botPts.map((v,i) => {
      const ri = botPts.length-1-i; const x = (ri/(botPts.length-1))*cW; const y = cH - ((v-minV)/(maxV-minV||1))*cH
      return `L${x.toFixed(1)},${y.toFixed(1)}`
    }),
    'Z'
  ].join(' ')

  const yLabels = [0,0.25,0.5,0.75,1].map(t => ({
    v: minV + t * (maxV - minV), y: cH - t * cH,
  }))

  const xLabels = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    d: Math.round(t * risk.mc_horizon_days), x: t * cW,
  }))

  return (
    <div className="card">
      <div className="section-label"><span>📊</span> Monte Carlo risk engine (10,000 paths)</div>

      <div style={{ overflowX: 'auto' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', minWidth: 300 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D4A0" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#00D4A0" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="chartClip">
              <rect x={PAD.l} y={PAD.t} width={cW} height={cH} />
            </clipPath>
          </defs>

          {/* Grid */}
          <g transform={`translate(${PAD.l},${PAD.t})`} clipPath="url(#chartClip)">
            {yLabels.map(l => (
              <line key={l.y} x1={0} y1={l.y} x2={cW} y2={l.y} stroke="#2A3545" strokeWidth={1} />
            ))}

            {/* Confidence band */}
            <path d={areaPathD} fill="url(#areaGrad)" />

            {/* P5 */}
            <polyline points={p5} fill="none" stroke="#FF4D6A" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.8} />
            {/* P50 */}
            <polyline points={p50} fill="none" stroke="#00D4A0" strokeWidth={2.5} />
            {/* P95 */}
            <polyline points={p95} fill="none" stroke="#00D4A0" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.8} />
          </g>

          {/* Y axis labels */}
          {yLabels.map(l => (
            <text key={l.y} x={PAD.l - 6} y={PAD.t + l.y + 4}
              textAnchor="end" fontSize={9} fill="#5A6A80" fontFamily="JetBrains Mono,monospace">
              {formatINR(l.v)}
            </text>
          ))}

          {/* X axis labels */}
          {xLabels.map(l => (
            <text key={l.d} x={PAD.l + l.x} y={H - 6}
              textAnchor="middle" fontSize={9} fill="#5A6A80" fontFamily="JetBrains Mono,monospace">
              {l.d}d
            </text>
          ))}
        </svg>
      </div>

      {/* Legend + stats */}
      <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          { color: 'var(--bull)', label: '50th pct (median)', dashed: false },
          { color: 'var(--bull)', label: '95th pct', dashed: true },
          { color: 'var(--bear)', label: '5th pct (downside)', dashed: true },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width={20} height={6}>
              <line x1={0} y1={3} x2={20} y2={3}
                stroke={l.color} strokeWidth={l.dashed ? 1.5 : 2.5}
                strokeDasharray={l.dashed ? '4 3' : undefined} />
            </svg>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Terminal values */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
        {[
          { label: 'P5 terminal', value: formatINR(risk.mc_percentile_5.at(-1)), color: 'var(--bear)' },
          { label: 'P50 terminal', value: formatINR(risk.mc_percentile_50.at(-1)), color: 'var(--bull)' },
          { label: 'P95 terminal', value: formatINR(risk.mc_percentile_95.at(-1)), color: 'var(--bull)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--s2)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {[
          { label: 'VaR 95%', value: `${(risk.var_95 * 100).toFixed(2)}%` },
          { label: 'CVaR 95%', value: `${(risk.cvar_95 * 100).toFixed(2)}%` },
          { label: 'Max DD', value: `${(risk.max_drawdown * 100).toFixed(1)}%` },
          { label: 'Ann. Vol', value: `${(risk.portfolio_volatility * 100).toFixed(1)}%` },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--s2)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem', color: 'var(--bear)' }}>{k.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
