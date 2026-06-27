import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

// ── Design tokens (mirrors QUANTIS CSS vars in a dark terminal palette) ──
const T = {
  ink: "#0A0C0F", s0: "#0F1215", s1: "#161B22", s2: "#1E2530", s3: "#252D3A",
  border: "#2A3545", borderBright: "#3A4A5E",
  tp: "#E8EDF5", ts: "#8A9BB0", tm: "#5A6A80",
  bull: "#00D4A0", bear: "#FF4D6A", hv: "#FF8C42", rng: "#A0B4CC",
  accent: "#F5A623", mono: "#7EB8D4",
};

const REGIME_CFG = {
  bull:     { label: "BULL TRENDING",    color: T.bull, kelly: "Full Kelly (1.0×)",      desc: "Trending up, low vol. All experts active." },
  bear:     { label: "BEAR TRENDING",    color: T.bear, kelly: "Quarter Kelly (0.25×)",  desc: "Negative returns. Defensive mode." },
  high_vol: { label: "HIGH VOLATILITY",  color: T.hv,   kelly: "Zero Kelly (0.0×)",      desc: "Extreme vol. Cash or hedges only." },
  ranging:  { label: "RANGING",          color: T.rng,  kelly: "Half Kelly (0.5×)",      desc: "Near-zero returns. Mean-reversion." },
};

const GATE_CFG = {
  active:   { label: "GATE ACTIVE",   color: T.bull },
  degraded: { label: "GATE DEGRADED", color: T.accent },
  blocked:  { label: "GATE BLOCKED",  color: T.bear },
};

const SECTORS = ["Banking","IT","Energy","FMCG","Pharma","Auto","NBFC","Metals","Infra","Utilities","Telecom","Cement","Consumer","Insurance"];
const NIFTY_TICKERS = ["RELIANCE.NS","TCS.NS","HDFCBANK.NS","INFY.NS","ICICIBANK.NS","HINDUNILVR.NS","ITC.NS","SBIN.NS","BHARTIARTL.NS","KOTAKBANK.NS","LT.NS","AXISBANK.NS","BAJFINANCE.NS","ASIANPAINT.NS","MARUTI.NS","TITAN.NS","SUNPHARMA.NS","ULTRACEMCO.NS","WIPRO.NS","NTPC.NS"];

const SECTOR_COLORS = { Banking:"#58a6ff",IT:"#3fb950",Energy:"#f0883e",FMCG:"#bc8cff",Pharma:"#e3b341",Auto:"#ff7b72",NBFC:"#58a6ff",Metals:"#8b949e",Infra:"#d2a8ff",Default:"#8b949e" };

// ── Mock data generators ──
function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }
function rndN(lo, hi, n=4) { return +rnd(lo,hi).toFixed(n); }

function genMockResult(goal) {
  const tickers = NIFTY_TICKERS.slice(0, 15);
  const signals = tickers.map(t => {
    const ka = rndN(-0.04,0.09), la = rndN(-0.03,0.08), pa = rndN(-0.02,0.07), ia = rndN(-0.025,0.07);
    return { ticker:t, kan_alpha:ka, lgbm_alpha:la, patchtst_alpha:pa, il_alpha:ia, final_alpha:rndN(-0.02,0.09),
      shap_data:{ rsi_14:rndN(-0.02,0.03), macd_hist:rndN(-0.015,0.025), mamba_0:rndN(-0.01,0.02), bb_pct:rndN(-0.01,0.015), roc_10:rndN(-0.008,0.012), adx_14:rndN(-0.005,0.01), obv_norm:rndN(-0.005,0.008) },
      gate_active:true };
  }).sort((a,b) => b.final_alpha - a.final_alpha);

  const top = signals.slice(0,10);
  const rawW = top.map(s => Math.max(0, s.final_alpha));
  const wSum = rawW.reduce((a,b)=>a+b,0)||1;
  const weights = {};
  top.forEach((s,i) => { weights[s.ticker] = +Math.min(0.20, rawW[i]/wSum).toFixed(4); });

  const cap = goal.capital_inr || 500000;
  const h = goal.horizon_days || 252;
  const p5  = Array.from({length:h},(_,i) => Math.round(cap*(1+0.04*i/h-0.06*Math.sin(i/25))));
  const p50 = Array.from({length:h},(_,i) => Math.round(cap*(1+0.14*i/h)));
  const p95 = Array.from({length:h},(_,i) => Math.round(cap*(1+0.24*i/h+0.02*Math.sin(i/18))));

  const periods = [2022,2023,2024].map(y => {
    const sr = rndN(0.08,0.22,4), nr = rndN(0.06,0.18,4);
    return { start:`${y}-01-01`,end:`${y}-12-31`, strategy_return:sr,nifty_return:nr,alpha:+(sr-nr).toFixed(4),
      sharpe:rndN(0.8,2.0,3), sortino:rndN(1.0,2.5,3), calmar:rndN(0.5,1.8,3),
      max_drawdown:rndN(-0.15,-0.06,4), hit_rate:rndN(0.52,0.68,3), ic:rndN(0.04,0.12,4) };
  });

  const regime = ["bull","ranging","bull"][Math.floor(Math.random()*3)||0] || "bull";
  return {
    regime:{ state:regime, confidence:rndN(0.72,0.95,3), kelly_factor:REGIME_CFG[regime]?1.0:0.5,
      model_ic:rndN(0.04,0.09,4), gate_status:"active", transition_prob:[0.88,0.05,0.04,0.03] },
    goal:{ return_target:goal.return_target||0.15, max_drawdown:goal.max_drawdown||0.10,
      sectors_excluded:goal.sectors_excluded||[], capital_inr:cap, horizon_days:h, risk_tolerance:goal.risk_tolerance||"moderate" },
    signals, weights,
    commands: top.slice(0,8).map(s => ({
      ticker:s.ticker, action:s.final_alpha>0.04?"BUY":"HOLD",
      quantity:Math.max(1,Math.floor((weights[s.ticker]||0)*cap/rnd(500,3500))),
      amount_inr:+((weights[s.ticker]||0)*cap).toFixed(0), lot_compliant:true, reason:`Target: ${((weights[s.ticker]||0)*100).toFixed(1)}%`
    })),
    risk:{ var_95:-0.0812,var_99:-0.1243,cvar_95:-0.1094,cvar_99:-0.1587,
      max_drawdown:-0.0923,portfolio_volatility:rndN(0.14,0.20,4),
      portfolio_return_expected:rndN(0.14,0.22,4),sharpe_ratio:rndN(1.1,1.9,2),
      sortino_ratio:rndN(1.4,2.2,2),calmar_ratio:rndN(1.2,2.1,2),
      mc_percentile_5:p5,mc_percentile_50:p50,mc_percentile_95:p95,mc_horizon_days:h },
    backtest:{ periods, summary_sharpe:1.38,summary_calmar:1.21,summary_alpha:0.048,summary_max_drawdown:-0.112,ic_ir:0.74 }
  };
}

// ── Shared primitives ──
const Card = ({children, style={}}) => (
  <div style={{background:T.s1,border:`1px solid ${T.border}`,borderRadius:16,padding:20,...style}}>{children}</div>
);

const Badge = ({children, regime}) => {
  const c = regime==="bull"?T.bull:regime==="bear"?T.bear:regime==="high_vol"?T.hv:regime==="ranging"?T.rng:T.rng;
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"2px 10px",borderRadius:20,background:`${c}18`,color:c,border:`1px solid ${c}30`,fontFamily:"monospace",fontSize:11,fontWeight:700,letterSpacing:"0.06em"}}>{children}</span>;
};

const Pct = ({v,decimals=2}) => <span style={{color:v>=0?T.bull:T.bear,fontFamily:"monospace"}}>{v>=0?"+":""}{(v*100).toFixed(decimals)}%</span>;

const SectionLabel = ({icon,children}) => (
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
    {icon&&<span style={{fontSize:13,color:T.accent}}>{icon}</span>}
    <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:T.tm}}>{children}</span>
    <div style={{flex:1,height:1,background:T.border}}/>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// LIVE CRYPTO WIDGET (Coinbase WebSocket)
// ═══════════════════════════════════════════════════════════════
function LiveCryptoPanel() {
  const [prices, setPrices] = useState([]);
  const [candles, setCandles] = useState([]);
  const [ticker, setTicker] = useState({price:0,bid:0,ask:0});
  const [product, setProduct] = useState("BTC-USD");
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [trades, setTrades] = useState([]);
  const wsRef = useRef(null);
  const priceRef = useRef([]);

  const fetchCandles = useCallback(async (prod) => {
    try {
      const end = new Date().toISOString();
      const start = new Date(Date.now()-24*3600000).toISOString();
      const url = `https://api.exchange.coinbase.com/products/${prod}/candles?granularity=300&start=${start}&end=${end}`;
      const r = await fetch(url);
      if(!r.ok) throw new Error("Coinbase fail");
      const data = await r.json();
      if(!Array.isArray(data)||!data.length) throw new Error("empty");
      const df = data.map(([t,l,h,o,c,v])=>({time:new Date(t*1000).toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}),open:+o,high:+h,low:+l,close:+c,volume:+v})).sort((a,b)=>a.time>b.time?1:-1);
      setCandles(df);
    } catch {
      // Fallback: generate synthetic candles
      const base = product==="BTC-USD"?95000:product==="ETH-USD"?3200:150;
      const synth = Array.from({length:288},(_,i)=>({
        time:new Date(Date.now()-(287-i)*300000).toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}),
        open:base*(1+rnd(-0.02,0.02)), high:base*(1+rnd(0,0.025)), low:base*(1-rnd(0,0.025)), close:base*(1+rnd(-0.02,0.02)), volume:rnd(10,200)
      }));
      setCandles(synth);
    }
  }, [product]);

  const connect = useCallback((prod) => {
    if(wsRef.current) { try{wsRef.current.close();}catch{} }
    const ws = new WebSocket("wss://advanced-trade-ws.coinbase.com");
    wsRef.current = ws;
    ws.onopen = () => {
      setWsStatus("connected");
      ws.send(JSON.stringify({type:"subscribe",product_ids:[prod],channel:"ticker"}));
      ws.send(JSON.stringify({type:"subscribe",product_ids:[prod],channel:"market_trades"}));
    };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        const ch = d.channel;
        for(const ev of d.events||[]) {
          if(ev.type!=="update") continue;
          if(ch==="ticker") {
            for(const t of ev.tickers||[]) {
              if(t.product_id===prod) {
                const p = parseFloat(t.price)||0;
                setTicker({price:p,bid:parseFloat(t.bid)||0,ask:parseFloat(t.ask)||0});
                priceRef.current = [...priceRef.current.slice(-299),{t:Date.now(),p}];
                setPrices([...priceRef.current.slice(-80)]);
              }
            }
          }
          if(ch==="market_trades") {
            for(const tr of ev.trades||[]) {
              if(tr.product_id===prod) {
                setTrades(prev=>[{price:parseFloat(tr.price),size:parseFloat(tr.size),side:tr.side,time:new Date().toLocaleTimeString()},...prev].slice(0,20));
              }
            }
          }
        }
      } catch{}
    };
    ws.onerror = () => setWsStatus("error");
    ws.onclose = () => setWsStatus("disconnected");
  }, []);

  useEffect(()=>{ connect(product); fetchCandles(product); return()=>{if(wsRef.current)wsRef.current.close();}; },[product]);

  const recentCandles = candles.slice(-48);
  const spread = ticker.ask - ticker.bid;
  const lastClose = candles.length?candles[candles.length-1].close:ticker.price;
  const prev = candles.length>1?candles[candles.length-2].close:lastClose;
  const change1d = prev?(lastClose-prev)/prev:0;
  const buyVol = trades.filter(t=>t.side==="BUY").reduce((a,t)=>a+t.size,0);
  const sellVol = trades.filter(t=>t.side==="SELL").reduce((a,t)=>a+t.size,0);
  const sentiment = buyVol/(sellVol+1e-8);

  const priceChartData = prices.map((x,i)=>({i,p:x.p}));

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      {/* Left: main chart */}
      <Card style={{gridColumn:"1/-1"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <select value={product} onChange={e=>{setProduct(e.target.value);}} style={{background:T.s2,border:`1px solid ${T.border}`,color:T.tp,borderRadius:8,padding:"4px 10px",fontFamily:"monospace",fontSize:13}}>
              {["BTC-USD","ETH-USD","SOL-USD"].map(p=><option key={p}>{p}</option>)}
            </select>
            <span style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:T.tp}}>${(ticker.price||lastClose).toLocaleString("en",{maximumFractionDigits:2})}</span>
            <Pct v={change1d}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:wsStatus==="connected"?T.bull:T.bear,display:"inline-block"}}/>
            <span style={{fontFamily:"monospace",fontSize:11,color:T.tm}}>{wsStatus==="connected"?"LIVE WS":"OFFLINE"}</span>
            <button onClick={()=>{connect(product);fetchCandles(product);}} style={{background:T.s2,border:`1px solid ${T.border}`,color:T.ts,borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:11}}>↺ refresh</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {[["BID",ticker.bid?.toFixed(2)||"—"],["ASK",ticker.ask?.toFixed(2)||"—"],["SPREAD",spread>0?`$${spread.toFixed(2)}`:"—"],["SENTIMENT",sentiment>1.5?"BULLISH":sentiment<0.67?"BEARISH":"NEUTRAL"]].map(([k,v])=>(
            <div key={k} style={{background:T.s2,borderRadius:8,padding:"8px 12px"}}>
              <div style={{fontSize:10,color:T.tm,letterSpacing:"0.08em",marginBottom:3}}>{k}</div>
              <div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:k==="SENTIMENT"?(sentiment>1.5?T.bull:sentiment<0.67?T.bear:T.rng):T.tp}}>{v}</div>
            </div>
          ))}
        </div>

        {/* 5-min OHLC candle chart */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:11,color:T.tm,marginBottom:6,letterSpacing:"0.06em"}}>5-MIN CANDLES (24H)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={recentCandles} margin={{top:4,right:0,bottom:0,left:0}}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.bull} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={T.bull} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="time" tick={{fill:T.tm,fontSize:10}} tickLine={false} axisLine={false} interval={11}/>
              <YAxis tick={{fill:T.tm,fontSize:10}} tickLine={false} axisLine={false} width={65} tickFormatter={v=>`$${(v/1000).toFixed(1)}k`}/>
              <Tooltip contentStyle={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:8,color:T.tp,fontSize:12}} formatter={(v)=>`$${v.toLocaleString()}`}/>
              <Area type="monotone" dataKey="close" stroke={T.bull} strokeWidth={1.5} fill="url(#priceGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Live tick sparkline */}
        {priceChartData.length>2&&(
          <>
            <div style={{fontSize:11,color:T.tm,marginBottom:4,letterSpacing:"0.06em"}}>LIVE TICKS</div>
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={priceChartData}>
                <Line type="monotone" dataKey="p" stroke={T.accent} strokeWidth={1.5} dot={false}/>
                <Tooltip contentStyle={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:6,color:T.tp,fontSize:11}} formatter={v=>`$${v.toLocaleString()}`} labelFormatter={()=>""}/>
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Card>

      {/* Volume bars */}
      <Card>
        <SectionLabel>Volume</SectionLabel>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={recentCandles.slice(-24)} margin={{top:0,right:0,bottom:0,left:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="time" tick={{fill:T.tm,fontSize:9}} tickLine={false} axisLine={false} interval={5}/>
            <YAxis tick={{fill:T.tm,fontSize:9}} tickLine={false} axisLine={false} width={30}/>
            <Tooltip contentStyle={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:6,color:T.tp,fontSize:11}}/>
            <Bar dataKey="volume" fill={T.mono} radius={[2,2,0,0]} opacity={0.7}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent trades feed */}
      <Card>
        <SectionLabel>Recent trades</SectionLabel>
        <div style={{maxHeight:160,overflowY:"auto"}}>
          {trades.length===0&&<div style={{color:T.tm,fontSize:12,textAlign:"center",padding:16}}>Waiting for trades…</div>}
          {trades.map((t,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}30`,fontSize:12}}>
              <span style={{fontFamily:"monospace",color:t.side==="BUY"?T.bull:T.bear,fontWeight:600}}>{t.side}</span>
              <span style={{fontFamily:"monospace",color:T.tp}}>${parseFloat(t.price).toLocaleString()}</span>
              <span style={{fontFamily:"monospace",color:T.ts}}>{parseFloat(t.size).toFixed(4)}</span>
              <span style={{color:T.tm,fontSize:10}}>{t.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INPUT PAGE
// ═══════════════════════════════════════════════════════════════
const PIPELINE_STEPS = ["NL Parser","Mamba Encoder","KAN Alpha","LightGBM","PatchTST","HMM Regime","MoE Gating","CVaR Optimizer","Monte Carlo","Walk-Forward"];

function InputPage({onResult}) {
  const [nlGoal, setNlGoal] = useState("");
  const [form, setForm] = useState({
    return_target:15, max_drawdown:10, horizon_months:12,
    risk_tolerance:"moderate", capital_inr:500000, sectors_excluded:[],
  });
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const toggleSector = s => setForm(f=>({...f, sectors_excluded: f.sectors_excluded.includes(s)?f.sectors_excluded.filter(x=>x!==s):[...f.sectors_excluded,s]}));

  const run = async () => {
    if (!nlGoal.trim() && form.capital_inr < 1000) { setErr("Enter an investment goal or fill in the structured form."); return; }
    setErr(""); setRunning(true); setProgress(0);
    const goal = {
      return_target: form.return_target/100,
      max_drawdown: form.max_drawdown/100,
      horizon_days: Math.round(form.horizon_months*21),
      risk_tolerance: form.risk_tolerance,
      capital_inr: form.capital_inr,
      sectors_excluded: form.sectors_excluded,
    };
    const steps = PIPELINE_STEPS;
    for(let i=0;i<steps.length;i++) {
      await new Promise(r=>setTimeout(r, 900+Math.random()*400));
      setProgress(Math.round((i+1)/steps.length*100));
      setMsg(steps[i]+"…");
    }
    const result = genMockResult(goal);
    setRunning(false);
    onResult(result);
  };

  const EXAMPLES = [
    {label:"Aggressive growth",text:"15% annual returns, max 10% drawdown, ₹5L capital, 1 year, aggressive. Avoid Pharma."},
    {label:"Conservative income",text:"10% steady returns over 2 years, ₹10L, conservative, max 8% drawdown. Exclude cyclicals."},
    {label:"Index beater",text:"Beat NIFTY by 5%, moderate risk, ₹3L, 18 months. Exclude PSU banking."},
  ];

  return (
    <div style={{maxWidth:820,margin:"0 auto",paddingTop:32}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontFamily:"serif",fontSize:28,fontWeight:400,color:T.tp,marginBottom:8}}>
          <span style={{fontStyle:"italic",color:T.accent}}>Regime-aware</span> portfolio intelligence
        </h1>
        <p style={{color:T.ts,fontSize:14,maxWidth:560}}>Describe your goal in English or fill in the structured form below. The form always takes priority — NL is a convenience overlay.</p>
      </div>

      {/* NL — low weight, secondary */}
      <Card style={{marginBottom:16}}>
        <SectionLabel icon="💬">Natural language hint (optional)</SectionLabel>
        <p style={{fontSize:12,color:T.tm,marginBottom:10}}>Anything you type here is parsed for sentiment only. The structured parameters below are what actually drive the pipeline.</p>
        <textarea value={nlGoal} onChange={e=>setNlGoal(e.target.value)} disabled={running}
          placeholder='E.g. "I want stable income with limited downside and no IT exposure"'
          style={{width:"100%",background:T.s2,border:`1px solid ${T.border}`,borderRadius:10,color:T.tp,fontFamily:"inherit",fontSize:13,padding:"10px 14px",resize:"vertical",minHeight:68,outline:"none",boxSizing:"border-box"}}
        />
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
          <span style={{fontSize:11,color:T.tm,alignSelf:"center"}}>Examples:</span>
          {EXAMPLES.map(e=>(
            <button key={e.label} onClick={()=>setNlGoal(e.text)} style={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:11,color:T.ts,fontFamily:"inherit"}}>
              {e.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Structured form — HIGH weight */}
      <Card style={{marginBottom:16}}>
        <SectionLabel icon="🎯">Investment parameters (primary — these drive the pipeline)</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
          {[
            {k:"return_target",label:"Target return %/yr",min:1,max:50,step:1},
            {k:"max_drawdown",label:"Max drawdown %",min:1,max:40,step:1},
            {k:"horizon_months",label:"Horizon (months)",min:1,max:60,step:1},
          ].map(({k,label,min,max,step})=>(
            <div key={k}>
              <div style={{fontSize:11,color:T.ts,marginBottom:5,letterSpacing:"0.04em",textTransform:"uppercase",fontWeight:600}}>{label}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="range" min={min} max={max} step={step} value={form[k]}
                  onChange={e=>setForm(f=>({...f,[k]:+e.target.value}))} disabled={running}
                  style={{flex:1,accentColor:T.accent}}/>
                <span style={{fontFamily:"monospace",fontSize:14,color:T.accent,minWidth:38,textAlign:"right"}}>{form[k]}{k==="horizon_months"?"mo":"%"}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div>
            <div style={{fontSize:11,color:T.ts,marginBottom:5,letterSpacing:"0.04em",textTransform:"uppercase",fontWeight:600}}>Capital (₹)</div>
            <input type="number" min={10000} value={form.capital_inr}
              onChange={e=>setForm(f=>({...f,capital_inr:+e.target.value}))} disabled={running}
              style={{width:"100%",background:T.s2,border:`1px solid ${T.border}`,borderRadius:8,color:T.tp,padding:"8px 12px",fontFamily:"monospace",fontSize:13,boxSizing:"border-box"}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:T.ts,marginBottom:5,letterSpacing:"0.04em",textTransform:"uppercase",fontWeight:600}}>Risk tolerance</div>
            <select value={form.risk_tolerance} onChange={e=>setForm(f=>({...f,risk_tolerance:e.target.value}))} disabled={running}
              style={{width:"100%",background:T.s2,border:`1px solid ${T.border}`,borderRadius:8,color:T.tp,padding:"8px 12px",fontSize:13,boxSizing:"border-box"}}>
              {["conservative","moderate","aggressive"].map(v=><option key={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div style={{fontSize:11,color:T.ts,marginBottom:8,letterSpacing:"0.04em",textTransform:"uppercase",fontWeight:600}}>Exclude sectors</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {SECTORS.map(s=>(
              <button key={s} onClick={()=>toggleSector(s)} disabled={running}
                style={{padding:"3px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit",transition:"all 0.15s",
                  background:form.sectors_excluded.includes(s)?`${T.bear}18`:T.s2,
                  border:`1px solid ${form.sectors_excluded.includes(s)?T.bear:T.border}`,
                  color:form.sectors_excluded.includes(s)?T.bear:T.ts}}>
                {form.sectors_excluded.includes(s)?"✕ ":""}{s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {err&&<div style={{background:`${T.bear}18`,border:`1px solid ${T.bear}40`,borderRadius:8,padding:"8px 14px",color:T.bear,fontSize:13,marginBottom:12}}>{err}</div>}

      {running&&(
        <Card style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,color:T.ts}}>{msg}</span>
            <span style={{fontFamily:"monospace",color:T.accent,fontSize:13}}>{progress}%</span>
          </div>
          <div style={{height:4,background:T.s3,borderRadius:2,overflow:"hidden",marginBottom:10}}>
            <div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${T.accent},${T.bull})`,borderRadius:2,transition:"width 0.4s"}}/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {PIPELINE_STEPS.map((s,i)=>{
              const thresh=(i+1)/PIPELINE_STEPS.length*100;
              const done=progress>=thresh,active=progress>=thresh-10&&!done;
              return <span key={s} style={{fontSize:10,padding:"2px 8px",borderRadius:4,fontFamily:"monospace",
                background:done?`${T.bull}18`:active?`${T.accent}18`:T.s3,
                color:done?T.bull:active?T.accent:T.tm,
                border:`1px solid ${done?T.bull+"30":active?T.accent+"30":"transparent"}`}}>
                {done?"✓ ":active?"⟳ ":""}{s}
              </span>;
            })}
          </div>
        </Card>
      )}

      <button onClick={run} disabled={running}
        style={{background:running?"#888":T.accent,color:"#0A0C0F",border:"none",borderRadius:10,padding:"12px 28px",fontSize:15,fontWeight:700,cursor:running?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8}}>
        {running?"⟳ Running pipeline…":"⚡ Run QUANTIS Analysis"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RESULTS PAGE
// ═══════════════════════════════════════════════════════════════
function RegimePanel({regime}) {
  const cfg = REGIME_CFG[regime.state]||REGIME_CFG.bull;
  const gate = GATE_CFG[regime.gate_status]||GATE_CFG.active;
  return (
    <Card style={{background:`linear-gradient(135deg,${T.s1},${cfg.color}12)`,border:`1px solid ${cfg.color}30`}}>
      <div style={{fontSize:10,fontFamily:"monospace",color:T.tm,letterSpacing:"0.12em",marginBottom:10}}>HMM REGIME</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <span style={{width:10,height:10,borderRadius:"50%",background:cfg.color,boxShadow:`0 0 10px ${cfg.color}80`,display:"inline-block"}}/>
        <span style={{fontFamily:"monospace",fontWeight:700,fontSize:15,color:cfg.color,letterSpacing:"0.04em"}}>{cfg.label}</span>
      </div>
      <p style={{fontSize:12,color:T.tm,marginBottom:14}}>{cfg.desc}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div>
          <div style={{fontSize:10,color:T.tm,fontFamily:"monospace",letterSpacing:"0.06em",marginBottom:2}}>CONFIDENCE</div>
          <div style={{fontFamily:"monospace",fontSize:17,fontWeight:600,color:cfg.color}}>{(regime.confidence*100).toFixed(1)}%</div>
        </div>
        <div>
          <div style={{fontSize:10,color:T.tm,fontFamily:"monospace",letterSpacing:"0.06em",marginBottom:2}}>MODEL IC</div>
          <div style={{fontFamily:"monospace",fontSize:17,fontWeight:600,color:regime.model_ic>0.05?T.bull:regime.model_ic>0?T.accent:T.bear}}>{regime.model_ic.toFixed(4)}</div>
        </div>
      </div>
      <div style={{fontSize:11,color:cfg.color,fontWeight:600,marginBottom:12}}>{cfg.kelly}</div>
      {regime.transition_prob.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:T.tm,letterSpacing:"0.06em",fontFamily:"monospace",marginBottom:6}}>TRANSITION PROBS</div>
          {["Bull","Bear","HighVol","Ranging"].map((lbl,i)=>{
            const p=regime.transition_prob[i]||0;
            const cs=[T.bull,T.bear,T.hv,T.rng];
            return <div key={lbl} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontSize:10,color:T.tm,width:50,fontFamily:"monospace"}}>{lbl}</span>
              <div style={{flex:1,height:3,background:T.s3,borderRadius:2}}><div style={{width:`${p*100}%`,height:"100%",background:cs[i],borderRadius:2}}/></div>
              <span style={{fontSize:10,fontFamily:"monospace",color:cs[i],width:36,textAlign:"right"}}>{(p*100).toFixed(1)}%</span>
            </div>;
          })}
        </div>
      )}
      <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"2px 10px",borderRadius:20,background:`${gate.color}18`,color:gate.color,border:`1px solid ${gate.color}30`,fontFamily:"monospace",fontSize:10,fontWeight:700}}>
        <span style={{width:5,height:5,borderRadius:"50%",background:gate.color,display:"inline-block"}}/>{gate.label}
      </span>
    </Card>
  );
}

function OverviewKPIs({result}) {
  const r = result.risk;
  const kpis = [
    {label:"Expected return",value:`${(r.portfolio_return_expected*100).toFixed(1)}%`,color:T.bull},
    {label:"Sharpe ratio",value:r.sharpe_ratio.toFixed(2),color:r.sharpe_ratio>1?T.bull:T.accent},
    {label:"Sortino",value:r.sortino_ratio.toFixed(2),color:r.sortino_ratio>1.5?T.bull:T.accent},
    {label:"CVaR 95%",value:`${(r.cvar_95*100).toFixed(1)}%`,color:T.bear},
    {label:"Max drawdown",value:`${(r.max_drawdown*100).toFixed(1)}%`,color:T.bear},
    {label:"IC-IR",value:result.backtest.ic_ir.toFixed(2),color:result.backtest.ic_ir>0.5?T.bull:T.accent},
  ];
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
      {kpis.map(k=>(
        <Card key={k.label} style={{padding:"12px 16px"}}>
          <div style={{fontSize:10,color:T.tm,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
          <div style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
        </Card>
      ))}
    </div>
  );
}

function MonteCarloChart({risk}) {
  const N = risk.mc_percentile_50.length;
  const step = Math.max(1,Math.floor(N/60));
  const data = Array.from({length:Math.floor(N/step)},(_,i)=>({
    d:i*step,
    p5:risk.mc_percentile_5[i*step],
    p50:risk.mc_percentile_50[i*step],
    p95:risk.mc_percentile_95[i*step],
  }));
  const fmt = v=>`₹${(v/100000).toFixed(1)}L`;
  return (
    <Card>
      <SectionLabel icon="📊">Monte Carlo (10,000 paths)</SectionLabel>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{top:4,right:4,bottom:0,left:0}}>
          <defs>
            <linearGradient id="mcG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={T.bull} stopOpacity={0.15}/><stop offset="95%" stopColor={T.bull} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="d" tick={{fill:T.tm,fontSize:10}} tickLine={false} axisLine={false} label={{value:"Days",position:"insideBottomRight",fill:T.tm,fontSize:10,dy:10}}/>
          <YAxis tick={{fill:T.tm,fontSize:10}} tickLine={false} axisLine={false} width={60} tickFormatter={fmt}/>
          <Tooltip contentStyle={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:8,color:T.tp,fontSize:12}} formatter={v=>fmt(v)}/>
          <Area type="monotone" dataKey="p95" stroke={T.bull} strokeWidth={1} fill="url(#mcG)" strokeDasharray="4 2" dot={false}/>
          <Area type="monotone" dataKey="p50" stroke={T.bull} strokeWidth={2} fill="none" dot={false}/>
          <Area type="monotone" dataKey="p5" stroke={T.bear} strokeWidth={1} fill="none" strokeDasharray="4 2" dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:16,marginTop:8,fontSize:11}}>
        {[["P5",T.bear,"5th pct"],["P50",T.bull,"Median"],["P95",T.bull,"95th pct"]].map(([l,c,d])=>(
          <span key={l} style={{display:"flex",alignItems:"center",gap:4,color:T.tm}}>
            <span style={{width:14,height:2,background:c,display:"inline-block",borderRadius:1}}/>{d}
          </span>
        ))}
      </div>
    </Card>
  );
}

function AlphaTable({signals,onSelect}) {
  return (
    <Card>
      <SectionLabel icon="⚡">Alpha signals</SectionLabel>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr>
              {["Ticker","KAN α","LGBM α","PatchTST α","IL α","Final α","Gate"].map(h=>(
                <th key={h} style={{textAlign:h==="Ticker"?"left":"right",padding:"6px 10px",fontSize:10,fontWeight:700,color:T.tm,letterSpacing:"0.06em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((s,i)=>(
              <tr key={s.ticker} onClick={()=>onSelect(s)} style={{cursor:"pointer",background:i%2===0?"transparent":T.s0+"40"}}>
                <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:600,color:T.tp,fontSize:12}}>{s.ticker.replace(".NS","")}</td>
                {[s.kan_alpha,s.lgbm_alpha,s.patchtst_alpha,s.il_alpha,s.final_alpha].map((v,j)=>(
                  <td key={j} style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:v>=0?T.bull:T.bear}}>{v>=0?"+":""}{(v*100).toFixed(2)}%</td>
                ))}
                <td style={{padding:"8px 10px",textAlign:"right"}}>
                  <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${T.bull}18`,color:T.bull,fontFamily:"monospace"}}>✓ ACTIVE</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ShapWaterfall({signal}) {
  if(!signal) return null;
  const entries = Object.entries(signal.shap_data).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,7);
  const data = entries.map(([k,v])=>({name:k.replace(/_/g," "),value:+(v*100).toFixed(3)}));
  return (
    <Card>
      <SectionLabel icon="🔬">SHAP — {signal.ticker.replace(".NS","")}</SectionLabel>
      <div style={{fontSize:11,color:T.tm,marginBottom:10}}>Final α: <span style={{color:signal.final_alpha>=0?T.bull:T.bear,fontFamily:"monospace"}}>{signal.final_alpha>=0?"+":""}{(signal.final_alpha*100).toFixed(2)}%</span></div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{top:0,right:20,bottom:0,left:80}}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis type="number" tick={{fill:T.tm,fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`${v.toFixed(2)}%`}/>
          <YAxis type="category" dataKey="name" tick={{fill:T.ts,fontSize:10}} tickLine={false} axisLine={false} width={80}/>
          <Tooltip contentStyle={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:8,color:T.tp,fontSize:11}} formatter={v=>`${v.toFixed(3)}%`}/>
          <Bar dataKey="value" radius={[0,3,3,0]}>
            {data.map((d,i)=><Cell key={i} fill={d.value>=0?T.bull:T.bear}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function WeightsPanel({weights,commands}) {
  const entries = Object.entries(weights).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const COLORS = [T.bull,T.accent,T.mono,"#a78bfa","#60a5fa","#f97316","#ec4899","#84cc16","#22d3ee","#fb7185"];
  const pieData = entries.map(([k,v],i)=>({name:k.replace(".NS",""),value:+(v*100).toFixed(1),fill:COLORS[i%COLORS.length]}));

  return (
    <Card>
      <SectionLabel icon="🥧">Portfolio weights</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
              {pieData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
            </Pie>
            <Tooltip contentStyle={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:8,color:T.tp,fontSize:11}} formatter={v=>`${v}%`}/>
          </PieChart>
        </ResponsiveContainer>
        <div style={{overflowY:"auto",maxHeight:180}}>
          {entries.map(([t,w],i)=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",fontSize:11}}>
              <span style={{width:8,height:8,borderRadius:2,background:COLORS[i%COLORS.length],display:"inline-block",flexShrink:0}}/>
              <span style={{fontFamily:"monospace",color:T.ts,flex:1,fontSize:10}}>{t.replace(".NS","")}</span>
              <span style={{fontFamily:"monospace",color:T.tp,fontWeight:600}}>{(w*100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{marginTop:12,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>{["Ticker","Action","Qty","Amount"].map(h=><th key={h} style={{textAlign:h==="Action"||h==="Ticker"?"left":"right",padding:"5px 8px",fontSize:10,color:T.tm,letterSpacing:"0.05em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr></thead>
          <tbody>{commands.slice(0,8).map(c=>(
            <tr key={c.ticker}>
              <td style={{padding:"6px 8px",fontFamily:"monospace",fontSize:11,color:T.tp}}>{c.ticker.replace(".NS","")}</td>
              <td style={{padding:"6px 8px"}}>
                <span style={{fontSize:10,padding:"1px 8px",borderRadius:4,fontFamily:"monospace",fontWeight:700,
                  background:c.action==="BUY"?`${T.bull}18`:c.action==="SELL"?`${T.bear}18`:`${T.rng}18`,
                  color:c.action==="BUY"?T.bull:c.action==="SELL"?T.bear:T.rng}}>{c.action}</span>
              </td>
              <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",color:T.ts}}>{c.quantity}</td>
              <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",color:T.tp}}>₹{c.amount_inr.toLocaleString("en-IN")}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}

function BacktestReport({backtest}) {
  const data = backtest.periods.map(p=>({period:p.start.slice(0,4),strategy:+(p.strategy_return*100).toFixed(1),nifty:+(p.nifty_return*100).toFixed(1),alpha:+(p.alpha*100).toFixed(1)}));
  return (
    <Card>
      <SectionLabel icon="📈">Walk-forward backtest</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
        {[["Summary Sharpe",backtest.summary_sharpe.toFixed(2),T.bull],["Summary Calmar",backtest.summary_calmar.toFixed(2),T.bull],["Avg Alpha",`${(backtest.summary_alpha*100).toFixed(1)}%`,T.accent],["IC-IR",backtest.ic_ir.toFixed(2),T.mono]].map(([l,v,c])=>(
          <div key={l} style={{background:T.s2,borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:T.tm,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            <div style={{fontFamily:"monospace",fontSize:18,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{top:0,right:0,bottom:0,left:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="period" tick={{fill:T.tm,fontSize:11}} tickLine={false} axisLine={false}/>
          <YAxis tick={{fill:T.tm,fontSize:11}} tickLine={false} axisLine={false} width={40} tickFormatter={v=>`${v}%`}/>
          <Tooltip contentStyle={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:8,color:T.tp,fontSize:12}} formatter={v=>`${v}%`}/>
          <Bar dataKey="strategy" fill={T.bull} radius={[3,3,0,0]} name="Strategy"/>
          <Bar dataKey="nifty" fill={T.rng} radius={[3,3,0,0]} name="NIFTY 50"/>
          <Bar dataKey="alpha" fill={T.accent} radius={[3,3,0,0]} name="Alpha"/>
          <Legend iconType="square" iconSize={10} wrapperStyle={{fontSize:11,color:T.ts}}/>
        </BarChart>
      </ResponsiveContainer>
      <div style={{marginTop:12,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>{["Period","Strategy","NIFTY","Alpha","Sharpe","Sortino","Max DD","Hit Rate","IC"].map(h=>(
            <th key={h} style={{textAlign:"right",padding:"5px 8px",fontSize:10,color:T.tm,letterSpacing:"0.04em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>
          ))}</tr></thead>
          <tbody>{backtest.periods.map(p=>(
            <tr key={p.start} style={{borderBottom:`1px solid ${T.border}20`}}>
              <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",color:T.ts,fontSize:10}}>{p.start.slice(0,4)}</td>
              <td style={{padding:"6px 8px",textAlign:"right"}}><Pct v={p.strategy_return}/></td>
              <td style={{padding:"6px 8px",textAlign:"right"}}><Pct v={p.nifty_return}/></td>
              <td style={{padding:"6px 8px",textAlign:"right"}}><Pct v={p.alpha}/></td>
              <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",color:p.sharpe>1?T.bull:T.ts}}>{p.sharpe.toFixed(2)}</td>
              <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",color:T.ts}}>{p.sortino.toFixed(2)}</td>
              <td style={{padding:"6px 8px",textAlign:"right"}}><Pct v={p.max_drawdown}/></td>
              <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",color:T.ts}}>{(p.hit_rate*100).toFixed(1)}%</td>
              <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",color:T.ts}}>{p.ic.toFixed(4)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}

function ResultsPage({result,onBack}) {
  const [tab, setTab] = useState("overview");
  const [selSignal, setSelSignal] = useState(null);
  const tabs = ["overview","signals","portfolio","backtest","live"];

  return (
    <div style={{maxWidth:1100,margin:"0 auto",paddingTop:24}}>
      <button onClick={onBack} style={{background:T.s2,border:`1px solid ${T.border}`,color:T.ts,borderRadius:8,padding:"5px 14px",cursor:"pointer",fontSize:12,marginBottom:16}}>← New analysis</button>

      <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16,marginBottom:20}}>
        <RegimePanel regime={result.regime}/>
        <OverviewKPIs result={result}/>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,borderBottom:`1px solid ${T.border}`,marginBottom:24,overflowX:"auto"}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{background:"none",border:"none",cursor:"pointer",padding:"10px 16px",fontSize:13,fontWeight:500,fontFamily:"inherit",whiteSpace:"nowrap",
              color:tab===t?T.tp:T.tm,borderBottom:tab===t?`2px solid ${T.accent}`:"2px solid transparent",marginBottom:-1,transition:"color 0.15s"}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {tab==="overview"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <MonteCarloChart risk={result.risk}/>
          <WeightsPanel weights={result.weights} commands={result.commands}/>
        </div>
      )}
      {tab==="signals"&&(
        <div style={{display:"grid",gridTemplateColumns:selSignal?"1fr 340px":"1fr",gap:16}}>
          <AlphaTable signals={result.signals} onSelect={setSelSignal}/>
          {selSignal&&<ShapWaterfall signal={selSignal}/>}
        </div>
      )}
      {tab==="portfolio"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <WeightsPanel weights={result.weights} commands={result.commands}/>
          <MonteCarloChart risk={result.risk}/>
        </div>
      )}
      {tab==="backtest"&&<BacktestReport backtest={result.backtest}/>}
      {tab==="live"&&<LiveCryptoPanel/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════
function Navbar({view,setView,result,liveNifty}) {
  return (
    <nav style={{background:T.s0,borderBottom:`1px solid ${T.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:28,height:28,background:`linear-gradient(135deg,${T.accent},${T.bull})`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div>
        <span style={{fontFamily:"monospace",fontSize:15,fontWeight:700,letterSpacing:"-0.01em",color:T.tp}}>QUANTIS</span>
        <span style={{fontSize:10,color:T.tm,background:T.s2,padding:"1px 7px",borderRadius:4,fontFamily:"monospace",border:`1px solid ${T.border}`}}>v1.0 · NSE</span>
      </div>
      <div style={{display:"flex",gap:4}}>
        {["input","results"].map(v=>(
          <button key={v} onClick={()=>{if(v==="results"&&!result)return;setView(v);}}
            style={{background:view===v?T.s2:"transparent",border:view===v?`1px solid ${T.border}`:"1px solid transparent",color:view===v?T.tp:T.tm,padding:"4px 14px",borderRadius:6,cursor:v==="results"&&!result?"not-allowed":"pointer",fontSize:12,fontWeight:500,fontFamily:"inherit",opacity:v==="results"&&!result?0.4:1}}>
            {v==="input"?"Portfolio Input":"Analysis Results"}
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14,fontSize:11,fontFamily:"monospace"}}>
        {liveNifty&&(
          <span style={{color:T.tm}}>NIFTY <span style={{color:T.tp}}>{liveNifty.toLocaleString("en-IN",{maximumFractionDigits:2})}</span></span>
        )}
        <span style={{display:"flex",alignItems:"center",gap:4,color:T.bull}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:T.bull,display:"inline-block"}}/>LIVE
        </span>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("input");
  const [result, setResult] = useState(null);
  const [liveNifty, setLiveNifty] = useState(null);

  // Simulate live NIFTY ticker in navbar
  useEffect(()=>{
    setLiveNifty(22184 + rnd(-150,150));
    const iv = setInterval(()=>setLiveNifty(v=>v ? +(v+rnd(-30,30)).toFixed(2) : 22184), 8000);
    return ()=>clearInterval(iv);
  },[]);

  const handleResult = r => { setResult(r); setView("results"); };

  return (
    <div style={{background:T.ink,minHeight:"100vh",color:T.tp,fontFamily:"'Space Grotesk',system-ui,sans-serif"}}>
      <Navbar view={view} setView={setView} result={result} liveNifty={liveNifty}/>
      <div style={{padding:"0 24px 48px"}}>
        {view==="input"&&<InputPage onResult={handleResult}/>}
        {view==="results"&&result&&<ResultsPage result={result} onBack={()=>setView("input")}/>}
      </div>
    </div>
  );
}
