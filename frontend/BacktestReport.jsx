function Pct({ v, d = 1 }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
      color: v >= 0 ? 'var(--bull)' : 'var(--bear)',
    }}>
      {v >= 0 ? '+' : ''}{(v * 100).toFixed(d)}%
    </span>
  )
}

function BarChart({ data }) {
  const maxV = Math.max(...data.map(d => Math.max(d.strategy, d.nifty, 0.001)))
  const H = 120

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', height: H + 24, paddingBottom: 24, position: 'relative' }}>
      {/* Y grid */}
      {[0,0.5,1].map(t => (
        <div key={t} style={{
          position: 'absolute', left: 0, right: 0,
          bottom: 24 + t * H, height: 1, background: 'var(--border)',
          fontSize: '0.62rem', color: 'var(--text-muted',
        }} />
      ))}
      {data.map((d, i) => (
        <div key={d.start} style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flex: 1 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{
              height: Math.max(3, (d.strategy / maxV) * H),
              background: 'var(--bull)', borderRadius: '3px 3px 0 0', width: '100%', opacity: 0.85,
            }} />
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {d.start.slice(0, 4)}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              height: Math.max(3, (d.nifty_return / maxV) * H),
              background: 'var(--ranging)', borderRadius: '3px 3px 0 0', width: '100%', opacity: 0.7,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BacktestReport({ backtest }) {
  const summary = [
    { label: 'Summary Sharpe', value: backtest.summary_sharpe.toFixed(2), color: backtest.summary_sharpe > 1.2 ? 'var(--bull)' : 'var(--accent)' },
    { label: 'Summary Calmar', value: backtest.summary_calmar.toFixed(2), color: backtest.summary_calmar > 1 ? 'var(--bull)' : 'var(--accent)' },
    { label: 'Avg Alpha', value: `+${(backtest.summary_alpha * 100).toFixed(1)}%`, color: 'var(--accent)' },
    { label: 'IC-IR', value: backtest.ic_ir.toFixed(2), color: backtest.ic_ir > 0.5 ? 'var(--bull)' : 'var(--accent)' },
  ]

  return (
    <div className="card">
      <div className="section-label"><span>📉</span> Walk-forward backtest — 3-year validation</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {summary.map(s => (
          <div key={s.label} style={{ background: 'var(--s2)', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', gap: 14 }}>
          <span><span style={{ color: 'var(--bull)' }}>■</span> Strategy return</span>
          <span><span style={{ color: 'var(--ranging)' }}>■</span> NIFTY 50</span>
        </div>
        <BarChart data={backtest.periods} />
      </div>

      {/* Detailed table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              {['Period','Strategy','NIFTY','Alpha','Sharpe','Sortino','Calmar','Max DD','Hit Rate','IC'].map(h => (
                <th key={h} style={{ textAlign: ['Strategy','NIFTY','Alpha','Sharpe','Sortino','Calmar','Max DD','Hit Rate','IC'].includes(h) ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {backtest.periods.map(p => (
              <tr key={p.start}>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{p.start.slice(0,4)}</td>
                <td style={{ textAlign: 'right' }}><Pct v={p.strategy_return} /></td>
                <td style={{ textAlign: 'right' }}><Pct v={p.nifty_return} /></td>
                <td style={{ textAlign: 'right' }}><Pct v={p.alpha} /></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: p.sharpe > 1 ? 'var(--bull)' : 'var(--text-secondary)' }}>{p.sharpe.toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.sortino.toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.calmar.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}><Pct v={p.max_drawdown} /></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(p.hit_rate * 100).toFixed(1)}%</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: p.ic > 0.05 ? 'var(--bull)' : 'var(--accent)' }}>{p.ic.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Walk-forward: 252-day training · 63-day test · 21-day step · 21-day embargo gap<br />
        Risk-free rate: India 10yr G-sec 7.1% · Benchmark: NIFTY 50 (^NSEI)
      </div>
    </div>
  )
}
