'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { demoData, demoSeries, demoCampaigns } from './demo-data';

type Kpis = Record<string, number>;
interface DashboardResult { kpis: Kpis; variations: Record<string, number>; }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const PERIODS: Array<[string, string]> = [
  ['today', 'Hoje'], ['yesterday', 'Ontem'], ['7d', '7 dias'],
  ['30d', '30 dias'], ['90d', '90 dias'], ['365d', '365 dias'],
];

// Cards de destaque no topo
const HERO: Array<[string, string, 'money' | 'ratio' | 'pct' | 'int']> = [
  ['investido', 'Investimento', 'money'],
  ['receitaBruta', 'Receita', 'money'],
  ['lucroLiquido', 'Lucro Líquido', 'money'],
  ['roas', 'ROAS', 'ratio'],
  ['roi', 'ROI', 'ratio'],
  ['conversoes', 'Conversões', 'int'],
];
// Métricas secundárias
const SECONDARY: Array<[string, string, 'money' | 'ratio' | 'pct' | 'int']> = [
  ['receitaLiquida', 'Receita Líq.', 'money'],
  ['margem', 'Margem', 'pct'],
  ['ticketMedio', 'Ticket Médio', 'money'],
  ['cpa', 'CPA', 'money'],
  ['cpl', 'CPL', 'money'],
  ['cpm', 'CPM', 'money'],
  ['cac', 'CAC', 'money'],
  ['ctr', 'CTR', 'pct'],
];
const LOWER_IS_BETTER = new Set(['cpa', 'cpl', 'cpm', 'cac']);

function fmt(v: number, kind: 'money' | 'ratio' | 'pct' | 'int'): string {
  switch (kind) {
    case 'money': return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    case 'ratio': return `${v.toFixed(2)}×`;
    case 'pct':   return `${(v * 100).toFixed(1)}%`;
    case 'int':   return v.toLocaleString('pt-BR');
  }
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<DashboardResult | null>(null);
  const [live, setLive] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`${API}/dashboard/kpis?period=${period}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (active) { setData(d); setLive(true); } })
      .catch(() => { if (active) { setData(demoData(period)); setLive(false); } });
    return () => { active = false; };
  }, [period]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const kpis = data?.kpis ?? {};
  const variations = data?.variations ?? {};
  const series = useMemo(() => demoSeries(period), [period]);
  const campaigns = useMemo(() => demoCampaigns(period), [period]);

  const periodLabel = range.from && range.to
    ? `${range.from} → ${range.to}`
    : PERIODS.find(([id]) => id === period)?.[1] ?? '';

  return (
    <div>
      {/* Barra de controles */}
      <div className="controls">
        <div className="periods">
          {PERIODS.map(([id, lbl]) => (
            <button key={id} className={id === period && !range.from ? 'on' : ''} onClick={() => { setPeriod(id); setRange({ from: '', to: '' }); }}>{lbl}</button>
          ))}
        </div>
        <div className="cal-wrap" ref={calRef}>
          <button className={`cal-btn ${range.from ? 'on' : ''}`} onClick={() => setShowCal((s) => !s)}>
            🗓 {range.from && range.to ? `${range.from} → ${range.to}` : 'Personalizado'}
          </button>
          {showCal && (
            <div className="cal-pop">
              <label>De<input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></label>
              <label>Até<input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></label>
              <button className="cal-apply" disabled={!range.from || !range.to} onClick={() => setShowCal(false)}>Aplicar intervalo</button>
            </div>
          )}
        </div>
        <span className={live ? 'feed live' : 'feed demo'}>
          <i /> {live ? 'LIVE' : 'SANDBOX'}
        </span>
      </div>

      {/* Cards hero */}
      <div className="hero">
        {HERO.map(([k, label, kind]) => {
          const v = kpis[k] ?? 0;
          const varr = variations[k] ?? 0;
          const good = LOWER_IS_BETTER.has(k) ? varr < 0 : varr >= 0;
          return (
            <div className="card" key={k}>
              <span className="c-label">{label}</span>
              <span className="c-value">{fmt(v, kind)}</span>
              <span className={`c-var ${good ? 'up' : 'down'}`}>{varr >= 0 ? '▲' : '▼'} {Math.abs(varr * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>

      {/* Gráfico + secundárias */}
      <div className="mid">
        <div className="chart-box">
          <div className="chart-head">
            <span className="chart-title">EVOLUÇÃO · {periodLabel}</span>
            <span className="legend"><i className="li rec" /> Receita <i className="li inv" /> Investimento</span>
          </div>
          <Chart series={series} />
        </div>
        <div className="secondary">
          <span className="sec-title">MÉTRICAS</span>
          <div className="sec-grid">
            {SECONDARY.map(([k, label, kind]) => (
              <div className="sec-item" key={k}>
                <span className="s-label">{label}</span>
                <span className="s-value">{fmt(kpis[k] ?? 0, kind)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de campanhas */}
      <div className="table-box">
        <span className="tb-title">DESEMPENHO POR CONTA</span>
        <table>
          <thead><tr><th>PLATAFORMA</th><th>CONTA</th><th className="num">INVESTIDO</th><th className="num">RECEITA</th><th className="num">ROAS</th><th className="num">CONV.</th></tr></thead>
          <tbody>
            {campaigns.map((c, i) => (
              <tr key={i}>
                <td className="strong">{c.plataforma}</td>
                <td className="dim">{c.conta}</td>
                <td className="num">{c.investido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</td>
                <td className="num">{c.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</td>
                <td className="num"><span className={c.roas >= 3 ? 'roas good' : 'roas'}>{c.roas.toFixed(2)}×</span></td>
                <td className="num">{c.conversoes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .controls { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
        .periods { display: flex; gap: 2px; }
        .periods button { background: transparent; border: 1px solid #232823; color: #97a097; font-size: 11.5px; padding: 6px 13px; cursor: pointer; font-family: inherit; border-radius: 2px; }
        .periods button:hover { border-color: #3a4239; color: #d7dcd4; }
        .periods button.on { background: #b6ff3d; border-color: #b6ff3d; color: #0b0d0c; font-weight: 700; }
        .cal-wrap { position: relative; }
        .cal-btn { background: #0e100f; border: 1px solid #232823; color: #c3ccd6; font-size: 11.5px; padding: 6px 13px; cursor: pointer; font-family: inherit; border-radius: 2px; }
        .cal-btn:hover { border-color: #3a4239; }
        .cal-btn.on { border-color: #b6ff3d; color: #b6ff3d; }
        .cal-pop { position: absolute; top: 34px; left: 0; z-index: 40; background: #0e100f; border: 1px solid #232823; border-radius: 4px; padding: 14px; display: flex; flex-direction: column; gap: 10px; width: 200px; }
        .cal-pop label { font-size: 10.5px; color: #8a938a; display: flex; flex-direction: column; gap: 5px; letter-spacing: 0.06em; }
        .cal-pop input { background: #070807; border: 1px solid #232823; color: #eef3e8; padding: 7px 9px; border-radius: 2px; font-family: inherit; font-size: 12px; color-scheme: dark; }
        .cal-apply { background: #b6ff3d; color: #0b0d0c; border: none; padding: 8px; border-radius: 2px; font-family: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .cal-apply:disabled { opacity: 0.4; cursor: default; }
        .feed { margin-left: auto; display: flex; align-items: center; gap: 7px; font-size: 11px; letter-spacing: 0.06em; }
        .feed i { width: 7px; height: 7px; border-radius: 50%; }
        .feed.live { color: #b6ff3d; } .feed.live i { background: #b6ff3d; box-shadow: 0 0 8px #b6ff3d88; }
        .feed.demo { color: #e0a83d; } .feed.demo i { background: #e0a83d; box-shadow: 0 0 8px #e0a83d66; }

        .hero { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 14px; }
        @media (max-width: 1000px) { .hero { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 560px) { .hero { grid-template-columns: repeat(2, 1fr); } }
        .card { background: linear-gradient(180deg, #10130f, #0d0f0d); border: 1px solid #1c211d; border-radius: 6px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
        .c-label { font-size: 10.5px; letter-spacing: 0.1em; color: #7f887e; text-transform: uppercase; }
        .c-value { font-size: 22px; color: #eef3e8; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .c-var { font-size: 11.5px; font-variant-numeric: tabular-nums; }
        .c-var.up { color: #b6ff3d; } .c-var.down { color: #ff6a5a; }

        .mid { display: grid; grid-template-columns: 1fr 300px; gap: 12px; margin-bottom: 14px; }
        @media (max-width: 900px) { .mid { grid-template-columns: 1fr; } }
        .chart-box, .secondary, .table-box { background: #0e100f; border: 1px solid #1c211d; border-radius: 6px; padding: 16px 18px; }
        .chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .chart-title { font-size: 10.5px; letter-spacing: 0.16em; color: #6d766c; }
        .legend { font-size: 10.5px; color: #8a938a; display: flex; align-items: center; gap: 6px; }
        .legend .li { width: 9px; height: 3px; border-radius: 2px; display: inline-block; margin-left: 8px; }
        .legend .li.rec { background: #b6ff3d; } .legend .li.inv { background: #4a7bd1; }
        .sec-title, .tb-title { font-size: 10.5px; letter-spacing: 0.16em; color: #6d766c; display: block; margin-bottom: 14px; }
        .sec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 12px; }
        .sec-item { display: flex; flex-direction: column; gap: 3px; }
        .s-label { font-size: 10.5px; color: #7f887e; }
        .s-value { font-size: 16px; color: #e8ede4; font-variant-numeric: tabular-nums; }

        .table-box table { width: 100%; border-collapse: collapse; }
        .table-box th { text-align: left; font-size: 10px; letter-spacing: 0.1em; color: #5f685f; padding: 8px 10px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        .table-box td { padding: 11px 10px; border-bottom: 1px solid #141715; font-size: 13px; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .strong { color: #eef3e8; } .dim { color: #7f887e; }
        .roas { color: #d7dcd4; } .roas.good { color: #b6ff3d; }
      `}</style>
    </div>
  );
}

/** Gráfico de área simples em SVG (receita vs investimento). */
function Chart({ series }: { series: Array<{ label: string; receita: number; investido: number }> }) {
  const W = 640, H = 180, P = 8;
  const max = Math.max(...series.map((s) => Math.max(s.receita, s.investido)), 1);
  const x = (i: number) => P + (i / (series.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const path = (key: 'receita' | 'investido') =>
    series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s[key]).toFixed(1)}`).join(' ');
  const area = `${path('receita')} L ${x(series.length - 1).toFixed(1)} ${H - P} L ${x(0).toFixed(1)} ${H - P} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="180" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b6ff3d" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#b6ff3d" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={P} x2={W - P} y1={H * g} y2={H * g} stroke="#1c211d" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#g)" />
      <path d={path('investido')} fill="none" stroke="#4a7bd1" strokeWidth="1.5" />
      <path d={path('receita')} fill="none" stroke="#b6ff3d" strokeWidth="2" />
    </svg>
  );
}
