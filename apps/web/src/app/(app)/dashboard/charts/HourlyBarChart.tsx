'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface HourlyPoint {
  hora: number;
  gasto: number;
  mensagens: number;
}

/**
 * Gráfico de barras por hora (0h-23h), D3 v7. Barras arredondadas, cor
 * cheia no pico e opacidade reduzida no resto, tooltip no hover mostrando
 * hora + valor exato. Responsivo via ResizeObserver.
 */
export function HourlyBarChart({
  points,
  color,
  valueKey,
  formatValue,
}: {
  points: HourlyPoint[];
  color: string;
  valueKey: 'gasto' | 'mensagens';
  formatValue: (v: number) => string;
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

    const margin = { top: 30, right: 8, bottom: 22, left: 8 };
    const w = width || container.clientWidth || 340;
    const height = 160;
    const innerWidth = Math.max(50, w - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${w} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', `${height}px`)
      .style('display', 'block');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(points.map((p) => String(p.hora)))
      .range([0, innerWidth])
      .padding(0.28);

    const values = points.map((p) => p[valueKey]);
    const maxV = Math.max(1, d3.max(values) ?? 1);
    const y = d3.scaleLinear().domain([0, maxV]).nice().range([innerHeight, 0]);

    const peakIdx = values.indexOf(Math.max(...values));
    const hasPeak = Math.max(...values) > 0;

    if (hasPeak) {
      svg
        .append('text')
        .attr('x', w / 2)
        .attr('y', 16)
        .attr('text-anchor', 'middle')
        .style('font-family', 'inherit')
        .style('font-size', '10.5px')
        .style('font-weight', '600')
        .attr('fill', '#eef3e8')
        .text(`pico ${String(points[peakIdx].hora).padStart(2, '0')}h · ${formatValue(values[peakIdx])}`);
    }

    const bars = g
      .selectAll('.bar')
      .data(points, (d) => String((d as HourlyPoint).hora))
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(String(d.hora)) ?? 0)
      .attr('width', x.bandwidth())
      .attr('rx', 2)
      .attr('fill', color)
      .attr('opacity', (_d, i) => (hasPeak && i === peakIdx ? 1 : 0.45))
      .attr('y', innerHeight)
      .attr('height', 0);

    if (reduceMotion) {
      bars.attr('y', (d) => y(d[valueKey])).attr('height', (d) => Math.max(innerHeight - y(d[valueKey]), 0.5));
    } else {
      bars
        .transition()
        .duration(650)
        .delay((_d, i) => i * 12)
        .ease(d3.easeCubicOut)
        .attr('y', (d) => y(d[valueKey]))
        .attr('height', (d) => Math.max(innerHeight - y(d[valueKey]), 0.5));
    }

    // eixo X — apenas horas de 3 em 3
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(points.filter((p) => p.hora % 3 === 0).map((p) => String(p.hora)))
          .tickFormat((d) => `${String(d).padStart(2, '0')}h`)
          .tickSize(0),
      )
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('text').attr('fill', '#5f685f').style('font-size', '8px').style('font-family', 'inherit'));

    // tooltip
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
      .style('z-index', '10')
      .style('transition', 'opacity 0.12s');

    g.selectAll('.bar')
      .on('mouseenter', function (event, d) {
        const dd = d as HourlyPoint;
        d3.select(this as SVGRectElement).attr('opacity', 1);
        const bx = (x(String(dd.hora)) ?? 0) + x.bandwidth() / 2;
        const flip = bx > innerWidth - 80;
        tooltip
          .html(`<strong>${String(dd.hora).padStart(2, '0')}h</strong><br/>${formatValue(dd[valueKey])}`)
          .style('opacity', 1)
          .style('left', flip ? 'auto' : `${margin.left + bx + 10}px`)
          .style('right', flip ? `${margin.right + (innerWidth - bx) + 10}px` : 'auto')
          .style('top', `${margin.top - 4}px`);
      })
      .on('mouseleave', function (_event, d) {
        const dd = d as HourlyPoint;
        const i = points.findIndex((p) => p.hora === dd.hora);
        d3.select(this as SVGRectElement).attr('opacity', hasPeak && i === peakIdx ? 1 : 0.45);
        tooltip.style('opacity', 0);
      });

    return () => {
      d3.select(container).selectAll('*').remove();
    };
  }, [points, width, color, valueKey, formatValue]);

  if (!points.length) {
    return <div className="chart-empty">Sem dados no período selecionado.</div>;
  }

  return <div ref={containerRef} style={{ position: 'relative', width: '100%' }} />;
}
