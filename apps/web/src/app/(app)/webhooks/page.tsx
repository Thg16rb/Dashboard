'use client';

import { useState } from 'react';

interface Endpoint { id: string; provider: string; url: string; active: boolean; }
interface Event { id: string; type: string; status: 'success' | 'failed' | 'pending'; attempts: number; at: string; }

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([
    { id: '1', provider: 'Stripe', url: '/webhooks/stripe/ep_1', active: true },
    { id: '2', provider: 'Hotmart', url: '/webhooks/hotmart/ep_2', active: true },
  ]);
  const [events, setEvents] = useState<Event[]>([
    { id: 'evt_a91', type: 'charge.succeeded', status: 'success', attempts: 1, at: '14:58:12' },
    { id: 'evt_a90', type: 'charge.succeeded', status: 'success', attempts: 1, at: '14:55:03' },
    { id: 'evt_a89', type: 'charge.refunded', status: 'failed', attempts: 3, at: '14:41:47' },
    { id: 'evt_a88', type: 'purchase.approved', status: 'success', attempts: 2, at: '14:39:20' },
  ]);
  const [toast, setToast] = useState('');

  function replay(id: string) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'success', attempts: e.attempts + 1 } : e)));
    setToast(`Evento ${id} reprocessado com sucesso.`);
    setTimeout(() => setToast(''), 3000);
  }

  function toggle(id: string) {
    setEndpoints((prev) => prev.map((e) => (e.id === id ? { ...e, active: !e.active } : e)));
  }

  return (
    <div>
      <p className="lead">
        Endpoints recebem eventos dos gateways com validação HMAC. Falhas são
        reprocessáveis (replay) a partir do payload armazenado.
      </p>

      <section className="block">
        <h3>ENDPOINTS</h3>
        <table>
          <thead><tr><th>PROVEDOR</th><th>URL</th><th>ESTADO</th><th></th></tr></thead>
          <tbody>
            {endpoints.map((e) => (
              <tr key={e.id}>
                <td className="strong">{e.provider}</td>
                <td className="mono dim">{e.url}</td>
                <td><span className={`badge ${e.active ? 'on' : 'off'}`}>{e.active ? '● ativo' : '○ inativo'}</span></td>
                <td className="right"><button className="ghost" onClick={() => toggle(e.id)}>{e.active ? 'Desativar' : 'Ativar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="block">
        <h3>EVENTOS RECENTES</h3>
        <table>
          <thead><tr><th>ID</th><th>TIPO</th><th>STATUS</th><th>TENT.</th><th>HORA</th><th></th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="mono dim">{e.id}</td>
                <td className="mono">{e.type}</td>
                <td><span className={`badge ${e.status}`}>{e.status === 'success' ? '✓ ok' : e.status === 'failed' ? '✕ falhou' : '○ pend.'}</span></td>
                <td className="mono">{e.attempts}</td>
                <td className="mono dim">{e.at}</td>
                <td className="right">
                  {e.status === 'failed' && <button className="ghost" onClick={() => replay(e.id)}>↻ Replay</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {toast && <div className="toast">{toast}</div>}

      <style jsx>{`
        .lead { color: #8a938a; font-size: 12.5px; line-height: 1.6; max-width: 68ch; margin: 0 0 26px; }
        .block { margin-bottom: 30px; }
        h3 { font-size: 10.5px; letter-spacing: 0.2em; color: #6d766c; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; letter-spacing: 0.12em; color: #5f685f; padding: 8px 12px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        td { padding: 11px 12px; border-bottom: 1px solid #141715; font-size: 13px; }
        .strong { color: #eef3e8; }
        .dim { color: #7f887e; }
        .mono { font-variant-numeric: tabular-nums; }
        .right { text-align: right; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 2px; }
        .badge.on, .badge.success { color: #b6ff3d; background: #16220a; }
        .badge.off, .badge.pending { color: #e0a83d; background: #2a2410; }
        .badge.failed { color: #ff6a5a; background: #240f0c; }
        .ghost { background: none; border: 1px solid #232823; color: #97a097; padding: 6px 12px; border-radius: 2px; font-family: inherit; font-size: 11.5px; cursor: pointer; }
        .ghost:hover { border-color: #3a4239; color: #d7dcd4; }
        .toast { position: fixed; bottom: 24px; right: 24px; background: #141a10; border: 1px solid #23301a; color: #b6ff3d; padding: 12px 18px; border-radius: 3px; font-size: 12.5px; }
      `}</style>
    </div>
  );
}
