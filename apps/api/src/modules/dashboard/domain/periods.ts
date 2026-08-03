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

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Retorna o range atual e o range anterior equivalente para o preset. */
export function resolvePeriod(
  preset: PeriodPreset,
  now = new Date(),
): { current: DateRange; previous: DateRange } {
  const today = startOfDay(now);
  const day = 86400000;

  const spanDays: Record<PeriodPreset, number> = {
    today: 1,
    yesterday: 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365,
  };

  let to = now;
  let from: Date;
  if (preset === 'yesterday') {
    to = today;
    from = new Date(today.getTime() - day);
  } else {
    from = new Date(today.getTime() - (spanDays[preset] - 1) * day);
  }

  const span = to.getTime() - from.getTime();
  const previous: DateRange = {
    from: new Date(from.getTime() - span),
    to: from,
  };
  return { current: { from, to }, previous };
}
