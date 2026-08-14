'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { ChartKind, MetricDef } from './metricsCatalog';
import { formatMetricValue } from './metricsCatalog';

export interface MetricPoint {
  date: string;
  value: number;
}

/**
 * Gráfico genérico de UMA métrica ao longo do tempo — usado pelo sistema de
 * "Adicionar Gráfico". Renderiza como linha, área ou barra dependendo de
 * `kind`. D3 v7, mesmo estilo visual dos demais gráficos.
 */
export function MetricChart({
  points,
  metric,
  kind,
}: {
  points: MetricPoint[];
  metric: MetricDef;
  kind: ChartKind;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);

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

    const margin = { top: 14, right: 14, bottom: 26, left: 44 };
    const w = width || container.clientWidth || 340;
    const height = 200;
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

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const parsed = points.map((p) => ({ ...p, dateObj: new Date(`${p.date}T00:00:00`) }));

    const maxV = Math.max(1, d3.max(parsed, (d) => d.value) ?? 1);
    const y = d3.scaleLinear().domain([0, maxV]).nice().range([innerHeight, 0]);

    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerWidth).tickFormat(() => ''))
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('.tick line').attr('stroke', '#1c211d').attr('stroke-dasharray', '2,3'));

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s')))
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('.tick line').remove())
      .call((sel) => sel.selectAll('text').attr('fill', '#6d766c').style('font-size', '9px').style('font-family', 'inherit'));

    if (kind === 'bar') {
      const x = d3
        .scaleBand()
        .domain(parsed.map((p) => p.date))
        .range([0, innerWidth])
        .padding(0.25);

      const bars = g
        .selectAll('.bar')
        .data(parsed)
        .join('rect')
        .attr('x', (d) => x(d.date) ?? 0)
        .attr('width', x.bandwidth())
        .attr('rx', 2)
        .attr('fill', metric.color)
        .attr('opacity', 0.85)
        .attr('y', innerHeight)
        .attr('height', 0);

      if (reduceMotion) {
        bars.attr('y', (d) => y(d.value)).attr('height', (d) => Math.max(innerHeight - y(d.value), 0.5));
      } else {
        bars
          .transition()
          .duration(600)
          .delay((_d, i) => i * (parsed.length > 40 ? 2 : 8))
          .attr('y', (d) => y(d.value))
          .attr('height', (d) => Math.max(innerHeight - y(d.value), 0.5));
      }

      const tickEvery = Math.max(1, Math.ceil(parsed.length / 6));
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(
          d3
            .axisBottom(x)
            .tickValues(parsed.filter((_d, i) => i % tickEvery === 0).map((d) => d.date))
            .tickFormat((d) => d3.timeFormat('%d %b')(new Date(`${d}T00:00:00`)))
            .tickSize(0),
        )
        .call((sel) => sel.select('.domain').remove())
        .call((sel) => sel.selectAll('text').attr('fill', '#5f685f').style('font-size', '8.5px').style('font-family', 'inherit'));
    } else {
      const x = d3
        .scaleTime()
        .domain(d3.extent(parsed, (d) => d.dateObj) as [Date, Date])
        .range([0, innerWidth]);

      const clipId = `metric-clip-${Math.random().toString(36).slice(2, 9)}`;
      svg
        .append('defs')
        .append('clipPath')
        .attr('id', clipId)
        .append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight + 4)
        .attr('y', -2);

      if (kind === 'area') {
        const gradId = `metric-grad-${Math.random().toString(36).slice(2, 9)}`;
        const grad = svg
          .append('defs')
          .append('linearGradient')
          .attr('id', gradId)
          .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
        grad.append('stop').attr('offset', '0%').attr('stop-color', metric.color).attr('stop-opacity', 0.3);
        grad.append('stop').attr('offset', '100%').attr('stop-color', metric.color).attr('stop-opacity', 0.02);

        const area = d3
          .area<(typeof parsed)[number]>()
          .x((d) => x(d.dateObj))
          .y0(innerHeight)
          .y1((d) => y(d.value))
          .curve(d3.curveMonotoneX);

        const areaPath = g
          .append('g')
          .attr('clip-path', `url(#${clipId})`)
          .append('path')
          .datum(parsed)
          .attr('fill', `url(#${gradId})`)
          .attr('d', area);

        if (!reduceMotion) areaPath.attr('opacity', 0).transition().duration(700).attr('opacity', 1);
      }

      const line = d3
        .line<(typeof parsed)[number]>()
        .x((d) => x(d.dateObj))
        .y((d) => y(d.value))
        .curve(d3.curveMonotoneX);

      const linePath = g
        .append('g')
        .attr('clip-path', `url(#${clipId})`)
        .append('path')
        .datum(parsed)
        .attr('fill', 'none')
        .attr('stroke', metric.color)
        .attr('stroke-width', 1.8)
        .attr('d', line);

      if (!reduceMotion) {
        const node = linePath.node();
        if (node) {
          const length = node.getTotalLength();
          linePath
            .attr('stroke-dasharray', `${length} ${length}`)
            .attr('stroke-dashoffset', length)
            .transition()
            .duration(800)
            .ease(d3.easeCubicOut)
            .attr('stroke-dashoffset', 0);
        }
      }

      const tickCount = Math.min(parsed.length, 6);
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(tickCount).tickFormat((d) => d3.timeFormat('%d %b')(d as Date)))
        .call((sel) => sel.select('.domain').attr('stroke', '#1c211d'))
        .call((sel) => sel.selectAll('.tick line').attr('stroke', '#1c211d'))
        .call((sel) => sel.selectAll('text').attr('fill', '#5f685f').style('font-size', '9px').style('font-family', 'inherit'));

      // tooltip + crosshair
      const tooltip = d3
        .select(container)
        .append('div')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('background', '#0b0d0c')
        .style('border', '1px solid #232823')
        .style('border-radius', '4px')
        .style('padding', '6px 10px')
        .style('font-size', '11px')
        .style('font-family', 'inherit')
        .style('color', '#e8ede4')
        .style('white-space', 'nowrap')
        .style('z-index', '10');

      const crosshair = g
        .append('line')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#3a4239')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .style('opacity', 0);

      const bisect = d3.bisector((d: (typeof parsed)[number]) => d.dateObj).left;

      g.append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mousemove', (event) => {
          const [mx] = d3.pointer(event, g.node());
          const x0 = x.invert(mx);
          let i = bisect(parsed, x0, 1);
          i = Math.min(Math.max(i, 1), parsed.length - 1);
          const d0 = parsed[i - 1];
          const d1 = parsed[i];
          const d = x0.getTime() - d0.dateObj.getTime() > d1.dateObj.getTime() - x0.getTime() ? d1 : d0;
          const tipX = x(d.dateObj);
          const flip = tipX > innerWidth - 100;
          crosshair.attr('x1', tipX).attr('x2', tipX).style('opacity', 1);
          tooltip
            .html(`<strong>${d3.timeFormat('%d %b %Y')(d.dateObj)}</strong><br/>${formatMetricValue(d.value, metric.format)}`)
            .style('opacity', 1)
            .style('left', flip ? 'auto' : `${margin.left + tipX + 12}px`)
            .style('right', flip ? `${margin.right + (innerWidth - tipX) + 12}px` : 'auto')
            .style('top', `${margin.top + 4}px`);
        })
        .on('mouseleave', () => {
          crosshair.style('opacity', 0);
          tooltip.style('opacity', 0);
        });
    }

    return () => {
      d3.select(container).selectAll('*').remove();
    };
  }, [points, width, metric, kind]);

  if (!points.length) {
    return <div className="chart-empty">Sem dados no período selecionado.</div>;
  }

  return <div ref={containerRef} style={{ position: 'relative', width: '100%' }} />;
}
