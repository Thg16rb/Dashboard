/** Períodos de comparação do dashboard (BLUEPRINT seção 8.2). */

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | '365d';

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * A coluna `date` de meta_campaign_insights é do tipo DATE (sem hora),
 * gravada por dia no fuso do anunciante (São Paulo). Para o Prisma filtrar
 * corretamente (gte/lte contra uma coluna DATE), o range precisa ser expresso
 * em MEIA-NOITE UTC das datas-calendário desejadas — assim `date >= from` e
 * `date <= to` batem dia-a-dia sem capturar o dia seguinte.
 *
 * "Hoje" é resolvido no calendário de São Paulo (UTC-3): pegamos o instante
 * atual, deslocamos -3h e lemos o dia; depois montamos o range como meia-noite
 * UTC dessa data-calendário.
 */
const SP_OFFSET_MS = 3 * 3600000; // UTC-3

/** Data-calendário (YYYY-MM-DD) de `d` no fuso de São Paulo. */
function spCalendarDate(d: Date): string {
  return new Date(d.getTime() - SP_OFFSET_MS).toISOString().slice(0, 10);
}

/** Meia-noite UTC de uma data-calendário YYYY-MM-DD. */
function utcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Soma `n` dias a uma data-calendário YYYY-MM-DD. */
function addDays(ymd: string, n: number): string {
  const d = utcMidnight(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Retorna o range atual e o range anterior equivalente para o preset. */
export function resolvePeriod(
  preset: PeriodPreset,
  now = new Date(),
): { current: DateRange; previous: DateRange } {
  const todayYmd = spCalendarDate(now);

  const spanDays: Record<PeriodPreset, number> = {
    today: 1,
    yesterday: 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365,
  };

  let fromYmd: string;
  let toYmd: string;

  if (preset === 'yesterday') {
    fromYmd = addDays(todayYmd, -1);
    toYmd = fromYmd;
  } else if (preset === 'today') {
    fromYmd = todayYmd;
    toYmd = todayYmd;
  } else {
    toYmd = todayYmd;
    fromYmd = addDays(todayYmd, -(spanDays[preset] - 1));
  }

  const span = spanDays[preset];
  const prevToYmd = addDays(fromYmd, -1);
  const prevFromYmd = addDays(prevToYmd, -(span - 1));

  return {
    current: { from: utcMidnight(fromYmd), to: utcMidnight(toYmd) },
    previous: { from: utcMidnight(prevFromYmd), to: utcMidnight(prevToYmd) },
  };
}
