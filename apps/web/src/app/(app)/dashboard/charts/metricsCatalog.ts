// Catálogo de métricas plotáveis ao longo do tempo (gráfico de evolução e
// gráficos customizados adicionados pelo dono). A chave bate com o campo
// retornado por GET /dashboard/timeseries.
export type MetricFormat = 'money' | 'int' | 'pct' | 'ratio';
export type ChartKind = 'line' | 'area' | 'bar';

export interface MetricDef {
  key: string;
  label: string;
  color: string;
  format: MetricFormat;
}

export const METRICS_CATALOG: MetricDef[] = [
  { key: 'investido', label: 'Investimento', color: '#4a9eff', format: 'money' },
  { key: 'mensagens', label: 'Mensagens (conversas)', color: '#b6ff3d', format: 'int' },
  { key: 'receita', label: 'Receita', color: '#ffb84a', format: 'money' },
  { key: 'leads', label: 'Leads', color: '#c084fc', format: 'int' },
  { key: 'compras', label: 'Compras', color: '#4ade80', format: 'int' },
  { key: 'alcance', label: 'Alcance', color: '#38bdf8', format: 'int' },
  { key: 'cliques', label: 'Cliques', color: '#f472b6', format: 'int' },
  { key: 'impressoes', label: 'Impressões', color: '#fbbf24', format: 'int' },
];

export const METRICS_BY_KEY: Record<string, MetricDef> = Object.fromEntries(
  METRICS_CATALOG.map((m) => [m.key, m]),
);

export function formatMetricValue(v: number, format: MetricFormat): string {
  switch (format) {
    case 'money':
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    case 'pct':
      return `${(v * 100).toFixed(1)}%`;
    case 'ratio':
      return `${v.toFixed(2)}×`;
    case 'int':
    default:
      return v.toLocaleString('pt-BR');
  }
}

export interface CustomChartConfig {
  id: string;
  metricKey: string;
  kind: ChartKind;
}

export const CUSTOM_CHARTS_STORAGE_KEY = 'dash.customCharts.v1';
