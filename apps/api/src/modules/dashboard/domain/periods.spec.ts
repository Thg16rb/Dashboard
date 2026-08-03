import { resolvePeriod } from './periods';

describe('resolvePeriod (BLUEPRINT seção 8.2)', () => {
  const now = new Date('2026-08-03T12:00:00.000Z');

  it('7d gera janela atual e anterior de mesmo tamanho', () => {
    const { current, previous } = resolvePeriod('7d', now);
    const curSpan = current.to.getTime() - current.from.getTime();
    const prevSpan = previous.to.getTime() - previous.from.getTime();
    expect(prevSpan).toBeCloseTo(curSpan, -3);
    // período anterior termina onde o atual começa
    expect(previous.to.getTime()).toBe(current.from.getTime());
  });

  it('yesterday cobre exatamente o dia anterior', () => {
    const { current } = resolvePeriod('yesterday', now);
    const spanDays =
      (current.to.getTime() - current.from.getTime()) / 86400000;
    expect(spanDays).toBeCloseTo(1, 5);
  });
});
