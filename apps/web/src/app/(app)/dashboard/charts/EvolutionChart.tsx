'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface TimeseriesPoint {
  date: string;
  investido: number;
  mensagens: number;
  receita: number;
  leads?: number;
  compras?: number;
  alcance?: number;
  cliques?: number;
  impressoes?: number;
}

const COLOR_MSG = '#b6ff3d';
const COLOR_INV = '#4a9eff';

/**
 * Gráfico de evolução — área/linha dupla eixo (D3 v7). Mensagens (verde,
 * eixo esquerdo) e Investimento (azul, eixo direito), curva suave,
 * gradiente na área, crosshair + tooltip no hover, animação de entrada.
 * Responsivo via ResizeObserver (re-renderiza no resize).
 */
export function EvolutionChart({ points }: { points: TimeseriesPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.abs(w - width) > 4) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    d3.select(container).selectAll('*').remove();

    if (!points.length) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const margin = { top: 16, right: 48, bottom: 26, left: 46 };
    const w = width || container.clientWidth || 720;
    const height = 240;
    const innerWidth = Math.max(50, w - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${w} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', `${height}px`)
      .style('display', 'block')
      .style('overflow', 'visible');

    const defs = svg.append('defs');

    const gradMsg = defs
      .append('linearGradient')
      .attr('id', 'grad-msg')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    gradMsg.append('stop').attr('offset', '0%').attr('stop-color', COLOR_MSG).attr('stop-opacity', 0.32);
    gradMsg.append('stop').attr('offset', '100%').attr('stop-color', COLOR_MSG).attr('stop-opacity', 0.02);

    const gradInv = defs
      .append('linearGradient')
      .attr('id', 'grad-inv')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    gradInv.append('stop').attr('offset', '0%').attr('stop-color', COLOR_INV).attr('stop-opacity', 0.22);
    gradInv.append('stop').attr('offset', '100%').attr('stop-color', COLOR_INV).attr('stop-opacity', 0.02);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const clipId = `evo-clip-${Math.random().toString(36).slice(2, 9)}`;
    defs
      .append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight + 4)
      .attr('y', -2);

    const parsedPoints = points.map((p) => ({ ...p, dateObj: new Date(`${p.date}T00:00:00`) }));

    const x = d3
      .scaleTime()
      .domain(d3.extent(parsedPoints, (d) => d.dateObj) as [Date, Date])
      .range([0, innerWidth]);

    const maxInv = Math.max(1, d3.max(parsedPoints, (d) => d.investido) ?? 1);
    const maxMsg = Math.max(1, d3.max(parsedPoints, (d) => d.mensagens) ?? 1);

    const yInv = d3.scaleLinear().domain([0, maxInv]).nice().range([innerHeight, 0]);
    const yMsg = d3.scaleLinear().domain([0, maxMsg]).nice().range([innerHeight, 0]);

    // grid horizontal sutil (eixo esquerdo)
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yMsg).ticks(4).tickSize(-innerWidth).tickFormat(() => ''))
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('.tick line').attr('stroke', '#1c211d').attr('stroke-dasharray', '2,3'));

    const lineMsg = d3
      .line<(typeof parsedPoints)[number]>()
      .x((d) => x(d.dateObj))
      .y((d) => yMsg(d.mensagens))
      .curve(d3.curveMonotoneX);

    const areaMsg = d3
      .area<(typeof parsedPoints)[number]>()
      .x((d) => x(d.dateObj))
      .y0(innerHeight)
      .y1((d) => yMsg(d.mensagens))
      .curve(d3.curveMonotoneX);

    const lineInv = d3
      .line<(typeof parsedPoints)[number]>()
      .x((d) => x(d.dateObj))
      .y((d) => yInv(d.investido))
      .curve(d3.curveMonotoneX);

    const areaInv = d3
      .area<(typeof parsedPoints)[number]>()
      .x((d) => x(d.dateObj))
      .y0(innerHeight)
      .y1((d) => yInv(d.investido))
      .curve(d3.curveMonotoneX);

    const clipG = g.append('g').attr('clip-path', `url(#${clipId})`);

    const areaInvPath = clipG.append('path').datum(parsedPoints).attr('fill', 'url(#grad-inv)').attr('d', areaInv);
    const areaMsgPath = clipG.append('path').datum(parsedPoints).attr('fill', 'url(#grad-msg)').attr('d', areaMsg);

    const lineInvPath = clipG
      .append('path')
      .datum(parsedPoints)
      .attr('fill', 'none')
      .attr('stroke', COLOR_INV)
      .attr('stroke-width', 1.8)
      .attr('d', lineInv);

    const lineMsgPath = clipG
      .append('path')
      .datum(parsedPoints)
      .attr('fill', 'none')
      .attr('stroke', COLOR_MSG)
      .attr('stroke-width', 1.8)
      .attr('d', lineMsg);

    if (!reduceMotion) {
      [lineInvPath, lineMsgPath].forEach((path) => {
        const node = path.node();
        if (!node) return;
        const length = node.getTotalLength();
        path
          .attr('stroke-dasharray', `${length} ${length}`)
          .attr('stroke-dashoffset', length)
          .transition()
          .duration(900)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      });
      [areaInvPath, areaMsgPath].forEach((path) => {
        path.attr('opacity', 0).transition().duration(900).attr('opacity', 1);
      });
    }

    // eixo X
    const tickCount = Math.min(parsedPoints.length, 6);
    g.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(tickCount).tickFormat((d) => d3.timeFormat('%d %b')(d as Date)))
      .call((sel) => sel.select('.domain').attr('stroke', '#1c211d'))
      .call((sel) => sel.selectAll('.tick line').attr('stroke', '#1c211d'))
      .call((sel) => sel.selectAll('text').attr('fill', '#5f685f').style('font-size', '9.5px').style('font-family', 'inherit'));

    // eixo Y esquerdo (mensagens)
    g.append('g')
      .attr('class', 'axis y-axis-left')
      .call(d3.axisLeft(yMsg).ticks(4).tickFormat(d3.format('~s')))
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('.tick line').remove())
      .call((sel) => sel.selectAll('text').attr('fill', COLOR_MSG).style('font-size', '9.5px').style('font-family', 'inherit'));

    // eixo Y direito (investido)
    g.append('g')
      .attr('class', 'axis y-axis-right')
      .attr('transform', `translate(${innerWidth},0)`)
      .call(d3.axisRight(yInv).ticks(4).tickFormat((d) => `R$${d3.format('~s')(d as number)}`))
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('.tick line').remove())
      .call((sel) => sel.selectAll('text').attr('fill', COLOR_INV).style('font-size', '9.5px').style('font-family', 'inherit'));

    // ---- Tooltip + crosshair ----
    const tooltip = d3
      .select(container)
      .append('div')
      .attr('class', 'evo-d3-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('background', '#0b0d0c')
      .style('border', '1px solid #232823')
      .style('border-radius', '4px')
      .style('padding', '8px 11px')
      .style('font-size', '11px')
      .style('font-family', 'inherit')
      .style('color', '#e8ede4')
      .style('line-height', '1.6')
      .style('white-space', 'nowrap')
      .style('z-index', '10')
      .style('transition', 'opacity 0.12s');

    const crosshair = g
      .append('line')
      .attr('class', 'crosshair')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#3a4239')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .style('opacity', 0);

    const bisectDate = d3.bisector((d: (typeof parsedPoints)[number]) => d.dateObj).left;
    const moneyFmt = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

    const overlay = g
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, g.node());
        const x0 = x.invert(mx);
        let i = bisectDate(parsedPoints, x0, 1);
        i = Math.min(Math.max(i, 1), parsedPoints.length - 1);
        const d0 = parsedPoints[i - 1];
        const d1 = parsedPoints[i];
        const d = x0.getTime() - d0.dateObj.getTime() > d1.dateObj.getTime() - x0.getTime() ? d1 : d0;

        crosshair.attr('x1', x(d.dateObj)).attr('x2', x(d.dateObj)).style('opacity', 1);

        const tipX = x(d.dateObj);
        const flip = tipX > innerWidth - 140;

        tooltip
          .html(
            `<strong>${d3.timeFormat('%d %b %Y')(d.dateObj)}</strong><br/>` +
              `<span style="color:${COLOR_INV}">● Investimento</span> ${moneyFmt(d.investido)}<br/>` +
              `<span style="color:${COLOR_MSG}">● Mensagens</span> ${d.mensagens.toLocaleString('pt-BR')}`,
          )
          .style('opacity', 1)
          .style('left', flip ? 'auto' : `${margin.left + tipX + 14}px`)
          .style('right', flip ? `${margin.right + (innerWidth - tipX) + 14}px` : 'auto')
          .style('top', `${margin.top + 6}px`);
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0);
        tooltip.style('opacity', 0);
      });

    return () => {
      d3.select(container).selectAll('*').remove();
    };
  }, [points, width]);

  if (!points.length) {
    return <div className="chart-empty">Sem dados no período selecionado.</div>;
  }

  return <div ref={containerRef} style={{ position: 'relative', width: '100%' }} />;
}
