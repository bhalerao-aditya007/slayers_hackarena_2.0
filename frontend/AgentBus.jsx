const TYPE_STYLE = {
  info:    { color: 'var(--text-secondary)', icon: '●' },
  regime:  { color: 'var(--accent)',         icon: '◆' },
  signal:  { color: 'var(--bull)',           icon: '▲' },
  gate:    { color: 'var(--hv)',             icon: '■' },
  alert:   { color: 'var(--bear)',           icon: '!' },
}

export default function AgentBus({ messages }) {
  return (
    <div className="card">
      <div className="section-label"><span>🤖</span> Agent message bus — live pipeline decisions</div>
      <div style={{
        height: 480, overflowY: 'auto', display: 'flex',
        flexDirection: 'column', gap: 2,
        fontFamily: 'var(--font-mono)', fontSize: '0.76rem',
      }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
            No messages yet — run an analysis to see agent decisions stream in.
          </div>
        )}
        {messages.map(m => {
          const sty = TYPE_STYLE[m.type] || TYPE_STYLE.info
          return (
            <div key={m.id} style={{
              display: 'grid',
              gridTemplateColumns: '70px 130px 1fr',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 5,
              background: m.type === 'regime' ? 'rgba(245,166,35,0.06)'
                        : m.type === 'gate' ? 'rgba(255,140,66,0.06)'
                        : m.type === 'alert' ? 'rgba(255,77,106,0.06)'
                        : 'transparent',
              borderLeft: `2px solid ${sty.color}30`,
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{m.timestamp}</span>
              <span style={{ color: sty.color, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sty.icon} {m.model}
              </span>
              <span style={{ color: m.type === 'regime' ? 'var(--accent)' : m.type === 'alert' ? 'var(--bear)' : 'var(--text-secondary)' }}>
                {m.message}
                {m.value !== undefined && (
                  <span style={{ color: 'var(--mono)', marginLeft: 6 }}>→ {typeof m.value === 'number' ? m.value.toFixed(4) : m.value}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
