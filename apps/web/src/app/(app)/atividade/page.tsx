'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface LogRow {
  id: string; kind: string; method: string; path: string;
  statusCode: number; durationMs: number; summary?: string; createdAt: string;
}

export default function AtividadePage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'http' | 'webhook'>('all');
  const [live, setLive] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { setLoadError(true); setRows([]); return; }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const kindQ = filter === 'all' ? '' : `?kind=${filter}`;
    fetch(`${API}/activity${kindQ}`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setRows(data); setLoadError(false); })
      .catch(() => { setLoadError(true); setRows([]); });
  }

  useEffect(() => {
    load();
    if (live) timer.current = setInterval(load, 3000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, live]);

  function statusClass(s: number) {
    if (s < 300) return 'ok';
    if (s < 400) return 'redir';
    if (s < 500) return 'warn';
    return 'err';
  }
  const ago = (iso: string) => {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    return new Date(iso).toLocaleTimeString('pt-BR', { hour12: false });
  };

  return (
    <div>
      <p className="lead">
        Tudo que entra e sai da API em tempo real — requisições HTTP e eventos de
        webhook, com status, tempo de resposta e resumo. Atualiza sozinho.
      </p>

      <div className="bar">
        <div className="filters">
          {(['all', 'http', 'webhook'] as const).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Tudo' : f === 'http' ? 'Requisições' : 'Webhooks'}
            </button>
          ))}
        </div>
        <button className={`livebtn ${live ? 'on' : ''}`} onClick={() => setLive((v) => !v)}>
          {live ? '● ao vivo' : '❚❚ pausado'}
        </button>
        {loadError && <span className="demo">falha ao carregar atividade</span>}
      </div>

      <div className="doc-scroll">
      <table>
        <thead><tr><th>QUANDO</th><th>TIPO</th><th>MÉTODO</th><th>ROTA</th><th className="num">STATUS</th><th className="num">TEMPO</th><th>RESUMO</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} className="empty">Sem atividade ainda.</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="dim">{ago(r.createdAt)}</td>
              <td><span className={`tag ${r.kind}`}>{r.kind === 'webhook' ? 'webhook' : 'http'}</span></td>
              <td className="method">{r.method}</td>
              <td className="mono path">{r.path}</td>
              <td className="num"><span className={`status ${statusClass(r.statusCode)}`}>{r.statusCode}</span></td>
              <td className="num dim">{r.durationMs}ms</td>
              <td className="dim">{r.summary ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <style jsx>{`
        .lead { color: #8a938a; font-size: 12.5px; line-height: 1.6; max-width: 74ch; margin: 0 0 22px; }
        .bar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .filters { display: flex; gap: 2px; }
        .filters button { background: transparent; border: 1px solid #232823; color: #97a097; font-size: 11.5px; padding: 6px 13px; cursor: pointer; font-family: inherit; border-radius: 2px; }
        .filters button:hover { border-color: #3a4239; color: #d7dcd4; }
        .filters button.on { background: #b6ff3d; border-color: #b6ff3d; color: #0b0d0c; font-weight: 700; }
        .livebtn { background: #0e100f; border: 1px solid #232823; color: #6d766c; font-size: 11.5px; padding: 6px 13px; cursor: pointer; font-family: inherit; border-radius: 2px; }
        .livebtn.on { color: #b6ff3d; border-color: #23301a; }
        .demo { margin-left: auto; font-size: 11px; color: #e0a83d; }
        .doc-scroll { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 720px; }
        th { text-align: left; font-size: 10px; letter-spacing: 0.1em; color: #5f685f; padding: 8px 10px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        td { padding: 9px 10px; border-bottom: 1px solid #141715; font-size: 12.5px; }
        .dim { color: #7f887e; }
        .mono { font-variant-numeric: tabular-nums; }
        .path { color: #c3ccd6; }
        .num { text-align: right; }
        .empty { color: #6d766c; text-align: center; }
        .tag { font-size: 10px; padding: 2px 7px; border-radius: 2px; }
        .tag.webhook { color: #b6ff3d; background: #16220a; }
        .tag.http { color: #6db3ff; background: #0e1f30; }
        .method { color: #c3ccd6; font-weight: 500; }
        .status { font-size: 11.5px; padding: 2px 7px; border-radius: 2px; font-variant-numeric: tabular-nums; }
        .status.ok { color: #b6ff3d; background: #16220a; }
        .status.redir { color: #6db3ff; background: #0e1f30; }
        .status.warn { color: #e0a83d; background: #2a2410; }
        .status.err { color: #ff6a5a; background: #240f0c; }
      `}</style>
    </div>
  );
}
