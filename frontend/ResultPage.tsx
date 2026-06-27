import { useState } from 'react'
import { useStore } from '../store/useStore'
import RegimePanel from '../components/dashboard/RegimePanel'
import OverviewKPIs from '../components/dashboard/OverviewKPIs'
import AlphaTable from '../components/dashboard/AlphaTable'
import ShapWaterfall from '../components/dashboard/ShapWaterfall'
import MonteCarloChart from '../components/dashboard/MonteCarloChart'
import PortfolioWeights from '../components/dashboard/PortfolioWeights'
import BacktestReport from '../components/dashboard/BacktestReport'
import AgentBus from '../components/dashboard/AgentBus'
import TradeCommands from '../components/dashboard/TradeCommands'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'signals', label: 'Alpha Signals' },
  { id: 'portfolio', label: 'Portfolio & Trades' },
  { id: 'risk', label: 'Risk & Monte Carlo' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'live', label: 'Agent Feed' },
]

export default function ResultsPage() {
  const { result, activeResultTab, setActiveResultTab, selectedSignal } = useStore()

  if (!result) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, color: 'var(--text-muted)' }}>
        No results yet. Run an analysis first.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 24 }} className="fade-in">
      {/* Regime + KPIs header */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 20 }}>
        <RegimePanel regime={result.regime} />
        <OverviewKPIs result={result} />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, borderBottom: '1px solid var(--border)',
        marginBottom: 24, paddingBottom: 0, overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveResultTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: '0.85rem', fontWeight: 500,
              fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
              color: activeResultTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeResultTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.15s',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="fade-in" key={activeResultTab}>
        {activeResultTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <MonteCarloChart risk={result.risk} goal={result.goal} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <PortfolioWeights weights={result.weights} commands={result.commands} goal={result.goal} />
            </div>
          </div>
        )}

        {activeResultTab === 'signals' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedSignal ? '1fr 380px' : '1fr', gap: 20, transition: 'all 0.2s' }}>
            <AlphaTable signals={result.signals} />
            {selectedSignal && <ShapWaterfall signal={selectedSignal} />}
          </div>
        )}

        {activeResultTab === 'portfolio' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <PortfolioWeights weights={result.weights} commands={result.commands} goal={result.goal} large />
            <TradeCommands commands={result.commands} />
          </div>
        )}

        {activeResultTab === 'risk' && (
          <MonteCarloChart risk={result.risk} goal={result.goal} large />
        )}

        {activeResultTab === 'backtest' && (
          <BacktestReport backtest={result.backtest} />
        )}

        {activeResultTab === 'live' && (
          <AgentBus />
        )}
      </div>
    </div>
  )
}
