import axios from 'axios'

const BASE = '/api'

export const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

export async function submitAnalysis(payload: {
  nl_goal: string
  portfolio: object[]
}) {
  const { data } = await api.post('/analyze', payload)
  return data as { job_id: string; status: string }
}

export async function getStatus(jobId: string) {
  const { data } = await api.get(`/status/${jobId}`)
  return data as { job_id: string; status: string; progress: number; message: string; error?: string }
}

export async function getPortfolioResult(jobId: string) {
  const { data } = await api.get(`/portfolio/${jobId}`)
  return data
}

export async function getStocks() {
  const { data } = await api.get('/stocks')
  return data
}

export async function getRegime() {
  const { data } = await api.get('/regime')
  return data
}

export async function runScenario(scenarioType: string, jobId: string) {
  const { data } = await api.post(`/scenario/${scenarioType}`, { job_id: jobId, scenario_type: scenarioType })
  return data
}

export function createJobWebSocket(jobId: string, onMessage: (d: unknown) => void) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${window.location.host}/ws/job/${jobId}`)
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)) } catch { }
  }
  return ws
}

export function createLiveWebSocket(onMessage: (d: unknown) => void) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${window.location.host}/ws/live`)
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)) } catch { }
  }
  return ws
}

export function formatINR(value: number): string {
  if (Math.abs(value) >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`
  if (Math.abs(value) >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`
  if (Math.abs(value) >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`
  return `₹${value.toFixed(0)}`
}

export function formatPct(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatNum(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

export const NIFTY50_TICKERS = [
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
  'HINDUNILVR.NS', 'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'KOTAKBANK.NS',
  'LT.NS', 'AXISBANK.NS', 'BAJFINANCE.NS', 'ASIANPAINT.NS', 'MARUTI.NS',
  'TITAN.NS', 'SUNPHARMA.NS', 'ULTRACEMCO.NS', 'WIPRO.NS', 'NTPC.NS',
  'ONGC.NS', 'POWERGRID.NS', 'HCLTECH.NS', 'BAJAJFINSV.NS',
  'COALINDIA.NS', 'TATAMOTORS.NS', 'ADANIENT.NS', 'JSWSTEEL.NS',
  'TATASTEEL.NS', 'TECHM.NS', 'NESTLEIND.NS', 'CIPLA.NS',
  'APOLLOHOSP.NS', 'DRREDDY.NS', 'BRITANNIA.NS', 'EICHERMOT.NS',
  'HEROMOTOCO.NS', 'GRASIM.NS', 'HINDALCO.NS', 'BPCL.NS',
]

export const SECTORS = [
  'Banking', 'IT', 'Energy', 'FMCG', 'Pharma', 'Auto',
  'NBFC', 'Metals', 'Infra', 'Utilities', 'Telecom',
  'Cement', 'Consumer', 'Insurance', 'Healthcare', 'Agri',
]
