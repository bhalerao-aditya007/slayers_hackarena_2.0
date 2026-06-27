export default function Navbar({ view, setView, result, job, niftyLevel, indiaVix }) {
  const regime = result?.regime
  const regimeColors = {
    bull: 'var(--bull)', bear: 'var(--bear)',
    high_vol: 'var(--hv)', ranging: 'var(--ranging)',
  }

  return (
    <nav style={{
      background: 'var(--s0)', borderBottom: '1px solid var(--border)',
      padding: '0 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: 54,
      position: 'sticky', top: 0, zIndex: 100,
      backdropFilter: 'blur(8px)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--bull) 100%)',
          borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, boxShadow: '0 2px 10px rgba(245,166,35,0.3)',
        }}>⚡</div>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '1.2rem',
          letterSpacing: '-0.01em', color: 'var(--text-primary)',
        }}>QUANTIS</span>
        <span style={{
          fontSize: '0.66rem', color: 'var(--text-muted)',
          background: 'var(--s2)', padding: '2px 8px',
          borderRadius: 4, fontFamily: 'var(--font-mono)',
          border: '1px solid var(--border)',
        }}>v1.0 · NSE/BSE</span>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[
          { id: 'input', label: 'Portfolio Input' },
          { id: 'results', label: 'Analysis Results' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => { if (id === 'results' && !result) return; setView(id) }}
            style={{
              background: view === id ? 'var(--s2)' : 'transparent',
              border: view === id ? '1px solid var(--border-bright)' : '1px solid transparent',
              color: view === id ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '5px 14px', borderRadius: 7,
              cursor: id === 'results' && !result ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem', fontWeight: 500,
              fontFamily: 'var(--font-body)', opacity: id === 'results' && !result ? 0.35 : 1,
              transition: 'all 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Right: live ticker + regime */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.74rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            NIFTY <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {niftyLevel.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            VIX <span style={{ color: indiaVix > 20 ? 'var(--hv)' : 'var(--text-primary)', fontWeight: 600 }}>
              {indiaVix.toFixed(2)}
            </span>
          </span>
        </div>

        {regime && (
          <div className={`badge badge-${regime.state === 'high_vol' ? 'hv' : regime.state}`}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: regimeColors[regime.state] || 'var(--ranging)',
              display: 'inline-block',
              boxShadow: `0 0 6px ${regimeColors[regime.state] || 'var(--ranging)'}`,
            }} />
            {regime.state.replace('_',' ').toUpperCase()}
          </div>
        )}

        {job.status === 'running' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            <span className="spin" style={{ fontSize: '0.8rem' }}>⟳</span> {job.progress}%
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--bull)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bull)', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>LIVE</span>
        </div>
      </div>
    </nav>
  )
}
