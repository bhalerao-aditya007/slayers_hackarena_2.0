import { useState } from 'react'

function Alpha({ v }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: v >= 0 ? 'var(--bull)' : 'var(--bear)', fontWeight: 500 }}>
      {v >= 0 ? '+' : ''}{(v * 100).toFixed(2)}%
    </span>
  )
}

export default function AlphaTable({ signals, onSelect, selected }) {
  const [sort, setSort] = useState({ col: 'final_alpha', dir: -1 })

  const sorted = [...signals].sort((a, b) => sort.dir * (b[sort.col] - a[sort.col]))

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: -s.dir } : { col, dir: -1 })
  }

  const cols = [
    { key: 'ticker', label: 'Ticker', sortable: false },
    { key: 'sector', label: 'Sector', sortable: false },
    { key: 'kan_alpha', label: 'KAN α', sortable: true },
    { key: 'lgbm_alpha', label: 'LGBM α', sortable: true },
    { key: 'patchtst_alpha', label: 'PatchTST α', sortable: true },
    { key: 'il_alpha', label: 'IL α', sortable: true },
    { key: 'final_alpha', label: 'MoE Final α', sortable: true },
    { key: 'gate', label: 'Gate', sortable: false },
  ]

  const SECTOR_COLORS = {
    Banking:'#58a6ff',IT:'#3fb950',Energy:'#f0883e',FMCG:'#bc8cff',
    Pharma:'#e3b341',Auto:'#ff7b72',NBFC:'#7eb8d4',Metals:'#8b949e',
    Infra:'#d2a8ff',Default:'#5a6a80',
  }

  return (
    <div className="card">
      <div className="section-label">
        <span>⚡</span> Alpha signals — click a row to view SHAP
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  style={{
                    cursor: c.sortable ? 'pointer' : 'default',
                    color: sort.col === c.key ? 'var(--accent)' : 'var(--text-muted)',
                    textAlign: ['kan_alpha','lgbm_alpha','patchtst_alpha','il_alpha','final_alpha'].includes(c.key) ? 'right' : 'left',
                    userSelect: 'none',
                    transition: 'color 0.15s',
                  }}>
                  {c.label} {c.sortable && sort.col === c.key ? (sort.dir === -1 ? '↓' : '↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const isSelected = selected?.ticker === s.ticker
              const sc = SECTOR_COLORS[s.sector] || SECTOR_COLORS.Default
              return (
                <tr key={s.ticker} onClick={() => onSelect(isSelected ? null : s)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'var(--s2)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    outline: isSelected ? '1px solid var(--accent)' : 'none',
                    transition: 'background 0.1s',
                  }}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    {s.displayTicker || s.ticker.replace('.NS','')}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4,
                      background: `${sc}18`, color: sc,
                    }}>{s.sector || '—'}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}><Alpha v={s.kan_alpha} /></td>
                  <td style={{ textAlign: 'right' }}><Alpha v={s.lgbm_alpha} /></td>
                  <td style={{ textAlign: 'right' }}><Alpha v={s.patchtst_alpha} /></td>
                  <td style={{ textAlign: 'right' }}><Alpha v={s.il_alpha} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem',
                      color: s.final_alpha >= 0.03 ? 'var(--bull)' : s.final_alpha >= 0 ? 'var(--accent)' : 'var(--bear)',
                    }}>
                      {s.final_alpha >= 0 ? '+' : ''}{(s.final_alpha * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      background: s.gate_active ? 'rgba(0,212,160,0.12)' : 'rgba(255,77,106,0.12)',
                      color: s.gate_active ? 'var(--bull)' : 'var(--bear)',
                    }}>
                      {s.gate_active ? '✓ ACTIVE' : '✗ BLOCKED'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        MoE weights: KAN 20% · LightGBM 40% · PatchTST 25% · IL 15% (bull regime)
      </div>
    </div>
  )
}
