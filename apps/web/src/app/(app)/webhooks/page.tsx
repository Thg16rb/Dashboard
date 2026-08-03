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
        <h3>COMO CONFIGURAR · ONDE PEGAR</h3>
        <p className="guide">
          Cada gateway envia notificações para uma <b>URL sua</b> (abaixo). Você copia essa URL
          e cola no painel do gateway, em &quot;Webhooks&quot;. Assim que uma venda acontece, ela chega
          aqui em tempo real — sem esperar a sincronização de 15 min.
        </p>
        <div className="doc-scroll">
        <table className="doc">
          <thead><tr><th>PROVEDOR</th><th>URL DO SEU WEBHOOK (copie)</th><th>ONDE COLAR NO PAINEL DELES</th><th>EVENTOS ÚTEIS</th></tr></thead>
          <tbody>
            <tr>
              <td className="strong">Stripe</td>
              <td className="mono url">https://api.dashboard.sistemautomacao.com/webhooks/stripe/&lt;id&gt;</td>
              <td className="dim">Developers → Webhooks → Add endpoint</td>
              <td className="mono dim">charge.succeeded, charge.refunded</td>
            </tr>
            <tr>
              <td className="strong">Mercado Pago</td>
              <td className="mono url">https://api.dashboard.sistemautomacao.com/webhooks/mercadopago/&lt;id&gt;</td>
              <td className="dim">Suas integrações → Webhooks / Notificações</td>
              <td className="mono dim">payment, merchant_order</td>
            </tr>
            <tr>
              <td className="strong">Hotmart</td>
              <td className="mono url">https://api.dashboard.sistemautomacao.com/webhooks/hotmart/&lt;id&gt;</td>
              <td className="dim">Ferramentas → Webhook (Postback)</td>
              <td className="mono dim">PURCHASE_APPROVED, PURCHASE_REFUNDED</td>
            </tr>
            <tr>
              <td className="strong">Kiwify</td>
              <td className="mono url">https://api.dashboard.sistemautomacao.com/webhooks/kiwify/&lt;id&gt;</td>
              <td className="dim">Apps → Webhooks</td>
              <td className="mono dim">order.paid, order.refunded</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p className="guide small">
          O <code>&lt;id&gt;</code> é gerado quando você cria o endpoint abaixo. Toda entrega é validada
          por assinatura <b>HMAC</b> — eventos sem assinatura válida são rejeitados.
        </p>
      </section>

      <section className="block">
        <h3>O QUE AS INTEGRAÇÕES PERMITEM (APIs)</h3>
        <div className="doc-scroll">
        <table className="doc">
          <thead><tr><th>PLATAFORMA</th><th>DADOS QUE PUXAMOS</th><th>MÉTODO</th></tr></thead>
          <tbody>
            <tr><td className="strong">Meta Ads</td><td className="dim">Gasto, impressões, cliques, conversões, campanhas, contas de anúncio (várias BMs)</td><td><span className="tag api">API</span></td></tr>
            <tr><td className="strong">Google Ads</td><td className="dim">Custo, cliques, conversões, campanhas, palavras-chave</td><td><span className="tag api">API</span></td></tr>
            <tr><td className="strong">TikTok Ads</td><td className="dim">Gasto, visualizações, cliques, conversões por campanha</td><td><span className="tag api">API</span></td></tr>
            <tr><td className="strong">Stripe / Mercado Pago</td><td className="dim">Vendas, valor bruto, taxas, reembolsos, status do pagamento</td><td><span className="tag both">API + Webhook</span></td></tr>
            <tr><td className="strong">Hotmart / Kiwify</td><td className="dim">Vendas aprovadas, reembolsos, comissões, cliente</td><td><span className="tag both">API + Webhook</span></td></tr>
          </tbody>
        </table>
        </div>
      </section>

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
        .guide { color: #8a938a; font-size: 12px; line-height: 1.6; max-width: 80ch; margin: 0 0 14px; }
        .guide b { color: #b6ff3d; font-weight: 500; }
        .guide.small { font-size: 11px; margin-top: 10px; }
        .guide code { background: #141715; color: #a98f6a; padding: 1px 5px; border-radius: 2px; }
        .doc-scroll { overflow-x: auto; }
        .doc { min-width: 640px; }
        .url { color: #b6ff3d; }
        .tag { font-size: 10.5px; padding: 2px 8px; border-radius: 2px; white-space: nowrap; }
        .tag.api { color: #6db3ff; background: #0e1f30; }
        .tag.both { color: #b6ff3d; background: #16220a; }
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
