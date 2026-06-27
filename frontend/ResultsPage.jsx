import { useState } from 'react'
import RegimePanel from '../components/RegimePanel'
import OverviewKPIs from '../components/OverviewKPIs'
import AlphaTable from '../components/AlphaTable'
import ShapWaterfall from '../components/ShapWaterfall'
import MonteCarloChart from '../components/MonteCarloChart'
import PortfolioWeights from '../components/PortfolioWeights'
import BacktestReport from '../components/BacktestReport'
import AgentBus from '../components/AgentBus'

const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'signals', label: '⚡ Alpha Signals' },
  { id: 'portfolio', label: '🥧 Portfolio' },
  { id: 'risk', label: '📈 Risk & MC' },
  { id: 'backtest', label: '📉 Backtest' },
  { id: 'feed', label: '🤖 Agent Feed' },
]

export default function ResultsPage({ result, agentMessages, onBack }) {
  const [tab, setTab] = useState('overview')
  const [selSignal, setSelSignal] = useState(null)

  if (!result) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: 'var(--text-muted)' }}>
      No results yet.
    </div>
  )

  return (
    <div style={{ maxWidth: 1260, margin: '0 auto', paddingTop: 26 }} className="fade-in">

      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← New analysis</button>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Capital: ₹{result.goal.capital_inr.toLocaleString('en-IN')} ·
          Horizon: {result.goal.horizon_days}d ·
          Tolerance: {result.goal.risk_tolerance}
        </div>
      </div>

      {/* Regime + KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginBottom: 20 }}>
        <RegimePanel regime={result.regime} />
        <OverviewKPIs result={result} />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        marginBottom: 24, overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelSignal(null) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 18px', fontSize: '0.83rem', fontWeight: 500,
              fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="fade-in" key={tab}>
        {tab === 'overview' && (
          <div className="g2">
            <MonteCarloChart risk={result.risk} />
            <PortfolioWeights weights={result.weights} commands={result.commands} goal={result.goal} />
          </div>
        )}
        {tab === 'signals' && (
          <div style={{ display: 'grid', gridTemplateColumns: selSignal ? '1fr 360px' : '1fr', gap: 18 }}>
            <AlphaTable signals={result.signals} onSelect={setSelSignal} selected={selSignal} />
            {selSignal && <ShapWaterfall signal={selSignal} onClose={() => setSelSignal(null)} />}
          </div>
        )}
        {tab === 'portfolio' && (
          <div className="g2">
            <PortfolioWeights weights={result.weights} commands={result.commands} goal={result.goal} large />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TradeCommandsPanel commands={result.commands} />
            </div>
          </div>
        )}
        {tab === 'risk' && <MonteCarloChart risk={result.risk} large />}
        {tab === 'backtest' && <BacktestReport backtest={result.backtest} />}
        {tab === 'feed' && <AgentBus messages={agentMessages} />}
      </div>
    </div>
  )
}

function TradeCommandsPanel({ commands }) {
  return (
    <div className="card">
      <div className="section-label"><span>📋</span> Trade commands</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Action</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Lot ✓</th>
            </tr>
          </thead>
          <tbody>
            {commands.map(c => (
              <tr key={c.ticker}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.83rem' }}>
                  {c.displayTicker || c.ticker.replace('.NS', '')}
                </td>
                <td>
                  <span className={`chip-${c.action.toLowerCase()}`}>{c.action}</span>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{c.quantity}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  ₹{c.amount_inr.toLocaleString('en-IN')}
                </td>
                <td style={{ color: c.lot_compliant ? 'var(--bull)' : 'var(--bear)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  {c.lot_compliant ? '✓' : '✗'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
