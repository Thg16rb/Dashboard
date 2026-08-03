'use client';

import { useEffect, useState } from 'react';
import { demoData } from './demo-data';

type Kpis = Record<string, number>;
interface DashboardResult {
  kpis: Kpis;
  variations: Record<string, number>;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const PERIODS = ['today', 'yesterday', '7d', '30d', '90d', '365d'] as const;

interface KpiMeta { label: string; fmt: 'money' | 'ratio' | 'pct' | 'int' | 'num'; }
const KPI_META: Record<string, KpiMeta> = {
  investido: { label: 'Investimento', fmt: 'money' },
  receitaBruta: { label: 'Receita Bruta', fmt: 'money' },
  receitaLiquida: { label: 'Receita Líquida', fmt: 'money' },
  lucroLiquido: { label: 'Lucro Líquido', fmt: 'money' },
  roi: { label: 'ROI', fmt: 'ratio' },
  roas: { label: 'ROAS', fmt: 'ratio' },
  cpa: { label: 'CPA', fmt: 'money' },
  cpl: { label: 'CPL', fmt: 'money' },
  cpm: { label: 'CPM', fmt: 'money' },
  ctr: { label: 'CTR', fmt: 'pct' },
  cac: { label: 'CAC', fmt: 'money' },
  ticketMedio: { label: 'Ticket Médio', fmt: 'money' },
  margem: { label: 'Margem', fmt: 'pct' },
  conversoes: { label: 'Conversões', fmt: 'int' },
};

function fmt(v: number, kind: KpiMeta['fmt']): string {
  switch (kind) {
    case 'money':
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    case 'ratio':
      return `${v.toFixed(2)}x`;
    case 'pct':
      return `${(v * 100).toFixed(1)}%`;
    case 'int':
      return v.toLocaleString('pt-BR');
    default:
      return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
}

// KPIs onde queda é boa (custos)
const LOWER_IS_BETTER = new Set(['cpa', 'cpl', 'cpm', 'cac']);

export default function DashboardPage() {
  const [period, setPeriod] = useState<string>('30d');
  const [data, setData] = useState<DashboardResult | null>(null);
  const [source, setSource] = useState<'api' | 'demo'>('demo');

  useEffect(() => {
    let active = true;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`${API}/dashboard/kpis?period=${period}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (active) { setData(d); setSource('api'); } })
      .catch(() => { if (active) { setData(demoData(period)); setSource('demo'); } });
    return () => { active = false; };
  }, [period]);

  const kpis = data?.kpis ?? {};
  const variations = data?.variations ?? {};

  return (
    <main className="page">
      <header className="head">
        <div>
          <h1>Dashboard</h1>
          <p className="crumb">Visão geral · tráfego pago &amp; financeiro</p>
        </div>
        <span className={`badge ${source}`}>
          {source === 'api' ? '● dados ao vivo' : '● dados de demonstração'}
        </span>
      </header>

      <div className="periods">
        {PERIODS.map((p) => (
          <button
            key={p}
            className={p === period ? 'on' : ''}
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <section className="grid">
        {Object.keys(KPI_META).map((k) => {
          const meta = KPI_META[k];
          const v = kpis[k] ?? 0;
          const varr = variations[k] ?? 0;
          const good = LOWER_IS_BETTER.has(k) ? varr < 0 : varr >= 0;
          return (
            <article key={k} className="card">
              <div className="card-label">{meta.label}</div>
              <div className="card-value">{fmt(v, meta.fmt)}</div>
              <div className={`card-var ${good ? 'up' : 'down'}`}>
                {varr >= 0 ? '▲' : '▼'} {Math.abs(varr * 100).toFixed(1)}%
                <span className="vs"> vs. período anterior</span>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="foot">
        Dashboard / TrafficIntel — os números acima são de demonstração enquanto as
        integrações reais (Meta, Stripe…) não estão conectadas.
      </footer>

      <style jsx>{`
        .page {
          max-width: 1140px; margin: 0 auto; padding: 32px 24px 64px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #e8edf3;
        }
        .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        h1 { margin: 0; font-size: 28px; letter-spacing: -0.01em; }
        .crumb { margin: 4px 0 0; color: #8b97a4; font-size: 13.5px; }
        .badge {
          font-size: 12px; padding: 5px 11px; border-radius: 999px; white-space: nowrap;
          font-weight: 600;
        }
        .badge.demo { background: #2a2410; color: #e3b341; }
        .badge.api { background: #123020; color: #4ac97e; }

        .periods { display: flex; gap: 8px; margin: 22px 0 20px; flex-wrap: wrap; }
        .periods button {
          padding: 7px 15px; border-radius: 8px; border: 1px solid #2a323d;
          background: #161b22; color: #c3ccd6; font-size: 13.5px; cursor: pointer;
          transition: all .12s ease;
        }
        .periods button:hover { border-color: #3d94ff; color: #fff; }
        .periods button.on { background: #1f6feb; border-color: #1f6feb; color: #fff; font-weight: 600; }

        .grid {
          display: grid; gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        }
        .card {
          background: linear-gradient(180deg, #161b22, #12161d);
          border: 1px solid #232b36; border-radius: 14px; padding: 16px 18px;
        }
        .card-label { font-size: 12px; color: #8b97a4; text-transform: uppercase; letter-spacing: .04em; }
        .card-value { font-size: 25px; font-weight: 700; margin: 8px 0 6px; font-variant-numeric: tabular-nums; }
        .card-var { font-size: 12.5px; font-variant-numeric: tabular-nums; }
        .card-var.up { color: #4ac97e; }
        .card-var.down { color: #f0736a; }
        .vs { color: #6b7682; }

        .foot { margin-top: 32px; color: #6b7682; font-size: 12.5px; }
      `}</style>
    </main>
  );
}
