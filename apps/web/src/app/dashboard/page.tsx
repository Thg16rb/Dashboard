'use client';

import { useEffect, useState } from 'react';

type Kpis = Record<string, number>;
interface DashboardResult {
  period: string;
  kpis: Kpis;
  variations: Record<string, number>;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const PERIODS = ['today', 'yesterday', '7d', '30d', '90d', '365d'] as const;

const LABELS: Record<string, string> = {
  investido: 'Investimento',
  receitaBruta: 'Receita Bruta',
  receitaLiquida: 'Receita Líquida',
  lucroLiquido: 'Lucro Líquido',
  roi: 'ROI',
  roas: 'ROAS',
  cpa: 'CPA',
  cpl: 'CPL',
  cpm: 'CPM',
  ctr: 'CTR',
  cac: 'CAC',
  ticketMedio: 'Ticket Médio',
  margem: 'Margem',
  conversoes: 'Conversões',
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<string>('30d');
  const [data, setData] = useState<DashboardResult | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`${API}/dashboard/kpis?period=${period}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [period]);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1>Dashboard</h1>
      <div style={{ display: 'flex', gap: 8, margin: '1rem 0' }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: p === period ? '#111' : '#fff',
              color: p === period ? '#fff' : '#111',
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {!data ? (
        <p>Faça login para carregar os KPIs (defina um token em localStorage).</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {Object.entries(data.kpis).map(([k, v]) => (
            <div
              key={k}
              style={{ border: '1px solid #eee', borderRadius: 10, padding: 14 }}
            >
              <div style={{ fontSize: 12, opacity: 0.6 }}>{LABELS[k] ?? k}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 12, color: (data.variations[k] ?? 0) >= 0 ? 'green' : 'crimson' }}>
                {((data.variations[k] ?? 0) * 100).toFixed(1)}% vs. anterior
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
