'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EvolutionChart, type TimeseriesPoint } from './charts/EvolutionChart';
import { HourlyBarChart, type HourlyPoint } from './charts/HourlyBarChart';
import { MetricChart, type MetricPoint } from './charts/MetricChart';
import {
  METRICS_CATALOG,
  METRICS_BY_KEY,
  CUSTOM_CHARTS_STORAGE_KEY,
  type ChartKind,
  type CustomChartConfig,
} from './charts/metricsCatalog';

type Kpis = Record<string, number>;
interface DashboardResult { kpis: Kpis; variations: Record<string, number>; }
type Fmt = 'money' | 'ratio' | 'pct' | 'int';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const STORAGE_KEY = 'dash.kpis.v1';
const PERIODS: Array<[string, string]> = [
  ['today', 'Hoje'], ['yesterday', 'Ontem'], ['7d', '7 dias'],
  ['30d', '30 dias'], ['90d', '90 dias'], ['365d', '365 dias'],
];

// Catálogo completo de KPIs disponíveis — o cliente escolhe quais mostrar.
const ALL_KPIS: Record<string, { label: string; fmt: Fmt }> = {
  investido:      { label: 'Investimento',  fmt: 'money' },
  receitaBruta:   { label: 'Receita Bruta', fmt: 'money' },
  receitaLiquida: { label: 'Receita Líquida', fmt: 'money' },
  lucroLiquido:   { label: 'Lucro Líquido', fmt: 'money' },
  roas:           { label: 'ROAS',          fmt: 'ratio' },
  roi:            { label: 'ROI',           fmt: 'ratio' },
  margem:         { label: 'Margem',        fmt: 'pct' },
  ticketMedio:    { label: 'Ticket Médio',  fmt: 'money' },
  conversoes:     { label: 'Conversões',    fmt: 'int' },
  cpa:            { label: 'CPA',           fmt: 'money' },
  cpl:            { label: 'CPL',           fmt: 'money' },
  cpm:            { label: 'CPM',           fmt: 'money' },
  cac:            { label: 'CAC',           fmt: 'money' },
  ctr:            { label: 'CTR',           fmt: 'pct' },
  mensagens:        { label: 'Mensagens (conversas)', fmt: 'int' },
  custoPorMensagem: { label: 'Custo por Mensagem',    fmt: 'money' },
  leadsMeta:        { label: 'Leads',                 fmt: 'int' },
  compras:          { label: 'Compras',                fmt: 'int' },
  alcance:          { label: 'Alcance',                fmt: 'int' },
  frequencia:       { label: 'Frequência',             fmt: 'ratio' },
  metaCpm:          { label: 'CPM (Meta)',              fmt: 'money' },
  metaCpc:          { label: 'CPC (Meta)',              fmt: 'money' },
  metaCpp:          { label: 'CPP (Meta)',              fmt: 'money' },
  metaCtr:          { label: 'CTR (Meta)',              fmt: 'pct' },
};
const KPI_ORDER = Object.keys(ALL_KPIS);
const DEFAULT_SELECTED = ['investido', 'receitaBruta', 'lucroLiquido', 'roas', 'roi', 'conversoes', 'mensagens', 'custoPorMensagem'];
const LOWER_IS_BETTER = new Set(['cpa', 'cpl', 'cpm', 'cac', 'custoPorMensagem', 'metaCpm', 'metaCpc', 'metaCpp']);
// Destaque visual — mensagens é a métrica prioritária pedida pelo dono.
const HIGHLIGHT_KPIS = new Set(['mensagens', 'custoPorMensagem']);

function fmt(v: number, kind: Fmt): string {
  switch (kind) {
    case 'money': return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
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
  const [loadError, setLoadError] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);
  const [editing, setEditing] = useState(false);
  const [realCampaigns, setRealCampaigns] = useState<Array<{ campanha: string; investido: number; receita: number; roas: number; conversoes: number }> | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[] | null>(null);
  const [hourly, setHourly] = useState<HourlyPoint[] | null>(null);
  const [customCharts, setCustomCharts] = useState<CustomChartConfig[]>([]);
  const [showAddChart, setShowAddChart] = useState(false);
  const [newMetricKey, setNewMetricKey] = useState<string>(METRICS_CATALOG[0]?.key ?? '');
  const [newChartKind, setNewChartKind] = useState<ChartKind>('area');
  const calRef = useRef<HTMLDivElement>(null);
  const addChartRef = useRef<HTMLDivElement>(null);

  // carrega a preferência salva do cliente
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) setSelected(arr);
      }
    } catch { /* ignore */ }
    try {
      const rawCharts = localStorage.getItem(CUSTOM_CHARTS_STORAGE_KEY);
      if (rawCharts) {
        const arr = JSON.parse(rawCharts);
        if (Array.isArray(arr)) setCustomCharts(arr);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (addChartRef.current && !addChartRef.current.contains(e.target as Node)) setShowAddChart(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function addCustomChart() {
    if (!newMetricKey) return;
    const cfg: CustomChartConfig = {
      id: `${newMetricKey}-${Date.now()}`,
      metricKey: newMetricKey,
      kind: newChartKind,
    };
    setCustomCharts((prev) => {
      const next = [...prev, cfg];
      localStorage.setItem(CUSTOM_CHARTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setShowAddChart(false);
  }

  function removeCustomChart(id: string) {
    setCustomCharts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      localStorage.setItem(CUSTOM_CHARTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace('/login'); return; }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

    // Zera o estado imediatamente ao trocar de período — evita mostrar
    // números do período anterior "pendurados" enquanto o fetch novo carrega.
    setData(null);
    setRealCampaigns(null);
    setTimeseries(null);
    setHourly(null);

    fetch(`${API}/dashboard/kpis?period=${period}`, { headers, cache: 'no-store' })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem('token');
          router.replace('/login');
          return Promise.reject();
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((d) => {
        if (!active) return;
        setData(d);
        setLive(!!d.hasData);
        setLoadError(false);
      })
      .catch(() => { if (active) { setData(null); setLive(false); setLoadError(true); } });

    // Campanhas reais (vendas por utm_campaign).
    fetch(`${API}/dashboard/campaigns?period=${period}`, { headers, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows) => { if (active) setRealCampaigns(Array.isArray(rows) && rows.length ? rows : []); })
      .catch(() => { if (active) setRealCampaigns([]); });

    // Série diária (gráfico de evolução).
    fetch(`${API}/dashboard/timeseries?period=${period}`, { headers, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows) => { if (active) setTimeseries(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (active) setTimeseries([]); });

    // Gasto e mensagens agregados por hora (0h-23h).
    fetch(`${API}/dashboard/hourly?period=${period}`, { headers, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows) => { if (active) setHourly(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (active) setHourly([]); });

    return () => { active = false; };
  }, [period, router]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggleKpi(k: string) {
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }
  function saveSelection() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    setEditing(false);
  }

  const kpis = data?.kpis ?? {};
  const variations = data?.variations ?? {};

  // cards = KPIs selecionados; métricas = os demais
  const cards = KPI_ORDER.filter((k) => selected.includes(k));
  const rest = KPI_ORDER.filter((k) => !selected.includes(k));
  const periodLabel = range.from && range.to ? `${range.from} → ${range.to}`
    : PERIODS.find(([id]) => id === period)?.[1] ?? '';

  return (
    <div>
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
        <button className={`edit-btn ${editing ? 'on' : ''}`} onClick={() => setEditing((e) => !e)}>
          {editing ? '✓ Concluir' : '✎ Personalizar'}
        </button>
        <span className={live ? 'feed live' : 'feed offline'}>
          <i /> {live ? 'LIVE' : 'SEM DADOS'}
        </span>
      </div>

      {loadError && (
        <div className="load-error">
          Não foi possível carregar os dados do painel. Verifique sua conexão ou tente novamente.
        </div>
      )}

      {editing && (
        <div className="editor">
          <div className="editor-head">
            <span>ESCOLHA OS INDICADORES DO SEU PAINEL</span>
            <button className="save" onClick={saveSelection}>Salvar preferências</button>
          </div>
          <div className="editor-grid">
            {KPI_ORDER.map((k) => {
              const on = selected.includes(k);
              return (
                <button key={k} className={`chip ${on ? 'on' : ''}`} onClick={() => toggleKpi(k)}>
                  <span className="check">{on ? '☑' : '☐'}</span> {ALL_KPIS[k].label}
                </button>
              );
            })}
          </div>
          <p className="editor-note">Sua seleção fica salva neste dispositivo — cada usuário monta o painel do seu jeito.</p>
        </div>
      )}

      <div className="hero">
        {cards.length === 0 && <div className="empty">Nenhum indicador selecionado. Clique em “Personalizar”.</div>}
        {cards.map((k) => {
          const meta = ALL_KPIS[k];
          const v = kpis[k] ?? 0;
          const varr = variations[k] ?? 0;
          const good = LOWER_IS_BETTER.has(k) ? varr < 0 : varr >= 0;
          const highlight = HIGHLIGHT_KPIS.has(k);
          return (
            <div className={`card ${highlight ? 'highlight' : ''}`} key={k}>
              <span className="c-label">{meta.label}</span>
              <span className="c-value">{fmt(v, meta.fmt)}</span>
              <span className={`c-var ${good ? 'up' : 'down'}`}>{varr >= 0 ? '▲' : '▼'} {Math.abs(varr * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>

      <div className="mid">
        <div className="chart-box">
          <div className="chart-head">
            <span className="chart-title">EVOLUÇÃO · {periodLabel}</span>
            <span className="legend"><i className="li rec" /> Mensagens <i className="li inv" /> Investimento</span>
          </div>
          {timeseries === null ? (
            <div className="chart-empty">Carregando…</div>
          ) : (
            <EvolutionChart points={timeseries} />
          )}
        </div>
        <div className="secondary">
          <span className="sec-title">DEMAIS MÉTRICAS</span>
          <div className="sec-grid">
            {rest.length === 0 && <span className="s-empty">Todos os indicadores estão nos cards.</span>}
            {rest.map((k) => (
              <div className="sec-item" key={k}>
                <span className="s-label">{ALL_KPIS[k].label}</span>
                <span className="s-value">{fmt(kpis[k] ?? 0, ALL_KPIS[k].fmt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hourly-row">
        <div className="chart-box">
          <div className="chart-head">
            <span className="chart-title">GASTO POR HORA</span>
          </div>
          {hourly === null ? (
            <div className="chart-empty">Carregando…</div>
          ) : (
            <HourlyBarChart
              points={hourly}
              color="#4a9eff"
              valueKey="gasto"
              formatValue={(v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            />
          )}
        </div>
        <div className="chart-box">
          <div className="chart-head">
            <span className="chart-title">MENSAGENS POR HORA</span>
          </div>
          {hourly === null ? (
            <div className="chart-empty">Carregando…</div>
          ) : (
            <HourlyBarChart
              points={hourly}
              color="#b6ff3d"
              valueKey="mensagens"
              formatValue={(v) => v.toLocaleString('pt-BR')}
            />
          )}
        </div>
      </div>

      <div className="custom-charts-head">
        <span className="chart-title">GRÁFICOS PERSONALIZADOS</span>
        <div className="add-chart-wrap" ref={addChartRef}>
          <button className="add-chart-btn" onClick={() => setShowAddChart((s) => !s)}>+ Adicionar Gráfico</button>
          {showAddChart && (
            <div className="add-chart-pop">
              <label>
                Métrica
                <select value={newMetricKey} onChange={(e) => setNewMetricKey(e.target.value)}>
                  {METRICS_CATALOG.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de gráfico
                <select value={newChartKind} onChange={(e) => setNewChartKind(e.target.value as ChartKind)}>
                  <option value="area">Área</option>
                  <option value="line">Linha</option>
                  <option value="bar">Barra</option>
                </select>
              </label>
              <button className="add-chart-confirm" onClick={addCustomChart}>Adicionar</button>
            </div>
          )}
        </div>
      </div>

      {customCharts.length > 0 && (
        <div className="custom-charts-grid">
          {customCharts.map((cfg) => {
            const metric = METRICS_BY_KEY[cfg.metricKey];
            if (!metric) return null;
            const points: MetricPoint[] = (timeseries ?? []).map((p) => ({
              date: p.date,
              value: (p as unknown as Record<string, number>)[cfg.metricKey] ?? 0,
            }));
            return (
              <div className="chart-box custom-chart-card" key={cfg.id}>
                <div className="chart-head">
                  <span className="chart-title">{metric.label.toUpperCase()} · {periodLabel}</span>
                  <button className="remove-chart-btn" onClick={() => removeCustomChart(cfg.id)} title="Remover gráfico">×</button>
                </div>
                {timeseries === null ? (
                  <div className="chart-empty">Carregando…</div>
                ) : (
                  <MetricChart points={points} metric={metric} kind={cfg.kind} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="table-box">
        <span className="tb-title">RECEITA POR CAMPANHA · vendas reais</span>
        {realCampaigns && realCampaigns.length > 0 ? (
          <table>
            <thead><tr><th>CAMPANHA (UTM)</th><th className="num">INVESTIDO</th><th className="num">RECEITA</th><th className="num">ROAS</th><th className="num">VENDAS</th></tr></thead>
            <tbody>
              {realCampaigns.map((c, i) => (
                <tr key={i}>
                  <td className="strong">{c.campanha}</td>
                  <td className="num">{c.investido ? c.investido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '— *'}</td>
                  <td className="num">{c.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</td>
                  <td className="num">{c.roas ? <span className={c.roas >= 3 ? 'roas good' : 'roas'}>{c.roas.toFixed(2)}×</span> : <span className="dim">— *</span>}</td>
                  <td className="num">{c.conversoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="chart-empty">Nenhuma venda com utm_campaign registrada neste período.</div>
        )}
        <p className="tb-note">* Investido/ROAS aparecem quando a conta de anúncios (Meta/Google) estiver conectada.</p>
      </div>

      <style jsx>{`
        .controls { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
        .periods { display: flex; gap: 2px; }
        .periods button { background: transparent; border: 1px solid #232823; color: #97a097; font-size: 11.5px; padding: 6px 13px; cursor: pointer; font-family: inherit; border-radius: 2px; }
        .periods button:hover { border-color: #3a4239; color: #d7dcd4; }
        .periods button.on { background: #b6ff3d; border-color: #b6ff3d; color: #0b0d0c; font-weight: 700; }
        .cal-wrap { position: relative; }
        .cal-btn, .edit-btn { background: #0e100f; border: 1px solid #232823; color: #c3ccd6; font-size: 11.5px; padding: 6px 13px; cursor: pointer; font-family: inherit; border-radius: 2px; }
        .cal-btn:hover, .edit-btn:hover { border-color: #3a4239; }
        .cal-btn.on, .edit-btn.on { border-color: #b6ff3d; color: #b6ff3d; }
        .cal-pop { position: absolute; top: 34px; left: 0; z-index: 40; background: #0e100f; border: 1px solid #232823; border-radius: 4px; padding: 14px; display: flex; flex-direction: column; gap: 10px; width: 200px; }
        .cal-pop label { font-size: 10.5px; color: #8a938a; display: flex; flex-direction: column; gap: 5px; }
        .cal-pop input { background: #070807; border: 1px solid #232823; color: #eef3e8; padding: 7px 9px; border-radius: 2px; font-family: inherit; font-size: 12px; color-scheme: dark; }
        .cal-apply { background: #b6ff3d; color: #0b0d0c; border: none; padding: 8px; border-radius: 2px; font-family: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .cal-apply:disabled { opacity: 0.4; cursor: default; }
        .feed { margin-left: auto; display: flex; align-items: center; gap: 7px; font-size: 11px; }
        .feed i { width: 7px; height: 7px; border-radius: 50%; }
        .feed.live { color: #b6ff3d; } .feed.live i { background: #b6ff3d; box-shadow: 0 0 8px #b6ff3d88; }
        .feed.offline { color: #e0a83d; } .feed.offline i { background: #e0a83d; box-shadow: 0 0 8px #e0a83d66; }
        .load-error { background: #240f0c; border: 1px solid #4a1c14; color: #ff6a5a; font-size: 12.5px; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; }
        .chart-empty { color: #6d766c; font-size: 12.5px; padding: 30px 18px; border: 1px dashed #232823; border-radius: 6px; text-align: center; }

        .editor { background: #0e100f; border: 1px solid #23301a; border-radius: 6px; padding: 16px 18px; margin-bottom: 16px; }
        .editor-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .editor-head span { font-size: 10.5px; letter-spacing: 0.14em; color: #8a938a; }
        .save { background: #b6ff3d; color: #0b0d0c; border: none; padding: 7px 14px; border-radius: 2px; font-family: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .editor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .chip { display: flex; align-items: center; gap: 8px; background: #070807; border: 1px solid #232823; color: #97a097; padding: 9px 12px; border-radius: 3px; font-family: inherit; font-size: 12.5px; cursor: pointer; text-align: left; }
        .chip:hover { border-color: #3a4239; }
        .chip.on { border-color: #23301a; background: #101a0c; color: #eef3e8; }
        .chip .check { color: #b6ff3d; font-size: 13px; }
        .editor-note { font-size: 11px; color: #6d766c; margin: 12px 0 0; }

        .hero { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 14px; }
        @media (max-width: 1100px) { .hero { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 720px) { .hero { grid-template-columns: repeat(2, 1fr); } }
        .empty { grid-column: 1 / -1; color: #6d766c; font-size: 12.5px; padding: 18px; border: 1px dashed #232823; border-radius: 6px; text-align: center; }
        .card { background: linear-gradient(180deg, #10130f, #0d0f0d); border: 1px solid #1c211d; border-radius: 6px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
        .card.highlight { border-color: #b6ff3d; box-shadow: 0 0 0 1px #b6ff3d33, 0 0 18px #b6ff3d22; background: linear-gradient(180deg, #131c0d, #0d0f0d); }
        .card.highlight .c-label { color: #b6ff3d; }
        .c-label { font-size: 10.5px; letter-spacing: 0.1em; color: #7f887e; text-transform: uppercase; }
        .c-value { font-size: 22px; color: #eef3e8; font-weight: 600; font-variant-numeric: tabular-nums; }
        .c-var { font-size: 11.5px; font-variant-numeric: tabular-nums; }
        .c-var.up { color: #b6ff3d; } .c-var.down { color: #ff6a5a; }

        .mid { display: grid; grid-template-columns: 1fr 300px; gap: 12px; margin-bottom: 14px; }
        @media (max-width: 900px) { .mid { grid-template-columns: 1fr; } }
        .chart-box, .secondary, .table-box { background: #0e100f; border: 1px solid #1c211d; border-radius: 6px; padding: 16px 18px; }
        .chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .chart-title { font-size: 10.5px; letter-spacing: 0.16em; color: #6d766c; }
        .legend { font-size: 10.5px; color: #8a938a; display: flex; align-items: center; gap: 6px; }
        .legend .li { width: 9px; height: 3px; border-radius: 2px; display: inline-block; margin-left: 8px; }
        .legend .li.rec { background: #b6ff3d; } .legend .li.inv { background: #4a9eff; }
        .hourly-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        @media (max-width: 900px) { .hourly-row { grid-template-columns: 1fr; } }
        .sec-title, .tb-title { font-size: 10.5px; letter-spacing: 0.16em; color: #6d766c; display: block; margin-bottom: 14px; }

        .custom-charts-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .add-chart-wrap { position: relative; }
        .add-chart-btn { background: #0e100f; border: 1px solid #232823; color: #b6ff3d; font-size: 11.5px; padding: 7px 14px; cursor: pointer; font-family: inherit; border-radius: 2px; font-weight: 600; }
        .add-chart-btn:hover { border-color: #b6ff3d; }
        .add-chart-pop { position: absolute; top: 34px; right: 0; z-index: 40; background: #0e100f; border: 1px solid #232823; border-radius: 4px; padding: 14px; display: flex; flex-direction: column; gap: 10px; width: 220px; }
        .add-chart-pop label { font-size: 10.5px; color: #8a938a; display: flex; flex-direction: column; gap: 5px; }
        .add-chart-pop select { background: #070807; border: 1px solid #232823; color: #eef3e8; padding: 7px 9px; border-radius: 2px; font-family: inherit; font-size: 12px; color-scheme: dark; }
        .add-chart-confirm { background: #b6ff3d; color: #0b0d0c; border: none; padding: 8px; border-radius: 2px; font-family: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .custom-charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 14px; }
        @media (max-width: 900px) { .custom-charts-grid { grid-template-columns: 1fr; } }
        .custom-chart-card { position: relative; }
        .remove-chart-btn { background: transparent; border: 1px solid #232823; color: #97a097; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; }
        .remove-chart-btn:hover { border-color: #ff6a5a; color: #ff6a5a; }
        .sec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 12px; }
        .s-empty { grid-column: 1/-1; color: #6d766c; font-size: 12px; }
        .sec-item { display: flex; flex-direction: column; gap: 3px; }
        .s-label { font-size: 10.5px; color: #7f887e; }
        .s-value { font-size: 16px; color: #e8ede4; font-variant-numeric: tabular-nums; }

        .table-box table { width: 100%; border-collapse: collapse; }
        .table-box th { text-align: left; font-size: 10px; letter-spacing: 0.1em; color: #5f685f; padding: 8px 10px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        .table-box td { padding: 11px 10px; border-bottom: 1px solid #141715; font-size: 13px; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .strong { color: #eef3e8; } .dim { color: #7f887e; }
        .roas { color: #d7dcd4; } .roas.good { color: #b6ff3d; }
        .tb-note { font-size: 11px; color: #6d766c; margin: 12px 0 0; }
      `}</style>
    </div>
  );
}
