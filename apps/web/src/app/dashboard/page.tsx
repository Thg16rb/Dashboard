'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { demoData } from './demo-data';

type Kpis = Record<string, number>;
interface DashboardResult {
  kpis: Kpis;
  variations: Record<string, number>;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const PERIODS: Array<[string, string]> = [
  ['today', 'HOJE'],
  ['yesterday', 'ONTEM'],
  ['7d', '7D'],
  ['30d', '30D'],
  ['90d', '90D'],
  ['365d', '365D'],
];

interface KpiMeta { label: string; fmt: 'money' | 'ratio' | 'pct' | 'int'; group: string; }
const KPI_META: Record<string, KpiMeta> = {
  investido:      { label: 'Investimento',  fmt: 'money', group: 'RESULTADO' },
  receitaBruta:   { label: 'Receita Bruta', fmt: 'money', group: 'RESULTADO' },
  receitaLiquida: { label: 'Receita Líq.',  fmt: 'money', group: 'RESULTADO' },
  lucroLiquido:   { label: 'Lucro Líquido', fmt: 'money', group: 'RESULTADO' },
  roi:            { label: 'ROI',           fmt: 'ratio', group: 'EFICIÊNCIA' },
  roas:           { label: 'ROAS',          fmt: 'ratio', group: 'EFICIÊNCIA' },
  margem:         { label: 'Margem',        fmt: 'pct',   group: 'EFICIÊNCIA' },
  ticketMedio:    { label: 'Ticket Médio',  fmt: 'money', group: 'EFICIÊNCIA' },
  cpa:            { label: 'CPA',           fmt: 'money', group: 'CUSTO' },
  cpl:            { label: 'CPL',           fmt: 'money', group: 'CUSTO' },
  cpm:            { label: 'CPM',           fmt: 'money', group: 'CUSTO' },
  cac:            { label: 'CAC',           fmt: 'money', group: 'CUSTO' },
  ctr:            { label: 'CTR',           fmt: 'pct',   group: 'VOLUME' },
  conversoes:     { label: 'Conversões',    fmt: 'int',   group: 'VOLUME' },
};

const GROUPS = ['RESULTADO', 'EFICIÊNCIA', 'CUSTO', 'VOLUME'];
const LOWER_IS_BETTER = new Set(['cpa', 'cpl', 'cpm', 'cac']);

function fmt(v: number, kind: KpiMeta['fmt']): string {
  switch (kind) {
    case 'money':
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    case 'ratio': return `${v.toFixed(2)}×`;
    case 'pct':   return `${(v * 100).toFixed(1)}%`;
    case 'int':   return v.toLocaleString('pt-BR');
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<DashboardResult | null>(null);
  const [live, setLive] = useState(false);
  const [clock, setClock] = useState('');

  // Protege a rota: sem token, volta ao console de acesso.
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('pt-BR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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

  const kpis = data?.kpis ?? {};
  const variations = data?.variations ?? {};

  return (
    <main className="terminal">
      <header className="bar">
        <div className="bar-left">
          <span className="mark">TRAFFIC<b>INTEL</b></span>
          <span className="sep" />
          <span className="ticker">
            <i className={live ? 'dot live' : 'dot demo'} />
            {live ? 'LIVE FEED' : 'SANDBOX'}
          </span>
        </div>
        <div className="bar-right">
          <span className="clock">{clock}</span>
        </div>
      </header>

      <div className="strip">
        <span className="strip-label">PERÍODO</span>
        <div className="periods">
          {PERIODS.map(([id, lbl]) => (
            <button key={id} className={id === period ? 'on' : ''} onClick={() => setPeriod(id)}>
              {lbl}
            </button>
          ))}
        </div>
        <span className="strip-note">
          comparação vs. período anterior equivalente
        </span>
      </div>

      <div className="board">
        {GROUPS.map((g) => (
          <section className="col" key={g}>
            <h2>{g}</h2>
            <div className="rows">
              {Object.entries(KPI_META)
                .filter(([, m]) => m.group === g)
                .map(([k, meta]) => {
                  const v = kpis[k] ?? 0;
                  const varr = variations[k] ?? 0;
                  const good = LOWER_IS_BETTER.has(k) ? varr < 0 : varr >= 0;
                  return (
                    <div className="row" key={k}>
                      <span className="k-label">{meta.label}</span>
                      <span className="k-value">{fmt(v, meta.fmt)}</span>
                      <span className={`k-var ${good ? 'up' : 'down'}`}>
                        {varr >= 0 ? '+' : ''}{(varr * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      <footer className="foot">
        <span>{live ? 'Dados em tempo real das integrações conectadas.' : 'Ambiente sandbox — dados simulados. Conecte Meta / Stripe para o feed real.'}</span>
        <span className="foot-r">dashboard.sistemautomacao.com</span>
      </footer>

      <style jsx>{`
        .terminal {
          min-height: 100vh;
          background: #0b0d0c;
          color: #d7dcd4;
          font-family: var(--font-mono), ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 13px;
          display: flex;
          flex-direction: column;
        }
        .bar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 20px;
          border-bottom: 1px solid #1c211d;
          background: #0e100f;
        }
        .bar-left { display: flex; align-items: center; gap: 14px; }
        .mark {
          font-size: 15px; letter-spacing: 0.14em; color: #e8ede4; font-weight: 500;
        }
        .mark b { color: #b6ff3d; font-weight: 700; }
        .sep { width: 1px; height: 16px; background: #2a312a; }
        .ticker {
          display: flex; align-items: center; gap: 7px;
          font-size: 11px; letter-spacing: 0.1em; color: #8a938a;
        }
        .dot { width: 7px; height: 7px; border-radius: 50%; }
        .dot.live { background: #b6ff3d; box-shadow: 0 0 8px #b6ff3d88; }
        .dot.demo { background: #e0a83d; box-shadow: 0 0 8px #e0a83d66; }
        .clock {
          font-size: 13px; letter-spacing: 0.08em; color: #8a938a;
          font-variant-numeric: tabular-nums;
        }
        .strip {
          display: flex; align-items: center; gap: 16px;
          padding: 10px 20px; border-bottom: 1px solid #1c211d;
        }
        .strip-label { font-size: 10.5px; letter-spacing: 0.16em; color: #5f685f; }
        .periods { display: flex; gap: 2px; }
        .periods button {
          background: transparent; border: 1px solid #232823;
          color: #97a097; font-size: 11.5px; letter-spacing: 0.06em;
          padding: 5px 13px; cursor: pointer; font-family: inherit;
          border-radius: 2px;
        }
        .periods button:hover { border-color: #3a4239; color: #d7dcd4; }
        .periods button.on {
          background: #b6ff3d; border-color: #b6ff3d; color: #0b0d0c; font-weight: 700;
        }
        .strip-note {
          margin-left: auto; font-size: 10.5px; color: #4c544c; letter-spacing: 0.04em;
        }
        .board {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: #1c211d;
          border-bottom: 1px solid #1c211d;
        }
        @media (max-width: 900px) { .board { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 520px) { .board { grid-template-columns: 1fr; } }
        .col { background: #0b0d0c; padding: 18px 20px 22px; }
        .col h2 {
          margin: 0 0 14px; font-size: 10.5px; letter-spacing: 0.2em;
          color: #6d766c; font-weight: 500;
          border-bottom: 1px solid #1c211d; padding-bottom: 10px;
        }
        .rows { display: flex; flex-direction: column; gap: 16px; }
        .row {
          display: grid;
          grid-template-columns: 1fr auto;
          grid-template-areas: 'label var' 'value var';
          align-items: baseline; column-gap: 10px; row-gap: 3px;
        }
        .k-label { grid-area: label; font-size: 11px; color: #7f887e; letter-spacing: 0.03em; }
        .k-value {
          grid-area: value; font-size: 22px; color: #eef3e8; font-weight: 500;
          letter-spacing: -0.01em; font-variant-numeric: tabular-nums;
        }
        .k-var {
          grid-area: var; align-self: center;
          font-size: 12px; font-variant-numeric: tabular-nums;
          padding: 2px 7px; border-radius: 2px;
        }
        .k-var.up { color: #b6ff3d; background: #16220a; }
        .k-var.down { color: #ff6a5a; background: #240f0c; }
        .foot {
          display: flex; justify-content: space-between;
          padding: 11px 20px; font-size: 11px; color: #545c53;
          letter-spacing: 0.03em;
        }
        .foot-r { color: #6d766c; }
      `}</style>
    </main>
  );
}
