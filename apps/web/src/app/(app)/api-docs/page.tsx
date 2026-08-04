'use client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface Ep { method: string; path: string; desc: string; auth: string; body?: string; resp?: string; }

const GROUPS: Array<{ title: string; endpoints: Ep[] }> = [
  {
    title: 'AUTENTICAÇÃO',
    endpoints: [
      { method: 'POST', path: '/auth/signup', desc: 'Cria empresa + usuário admin', auth: 'público',
        body: '{ "companyName": "Minha Empresa", "email": "voce@empresa.com", "password": "senha12345" }',
        resp: '{ "accessToken": "eyJ…", "refreshToken": "…" }' },
      { method: 'POST', path: '/auth/login', desc: 'Login (retorna token ou desafio 2FA)', auth: 'público',
        body: '{ "email": "voce@empresa.com", "password": "senha12345" }',
        resp: '{ "accessToken": "eyJ…" }  // use como Bearer token' },
      { method: 'POST', path: '/auth/refresh', desc: 'Renova o access token', auth: 'refresh token' },
    ],
  },
  {
    title: 'RECEBER VENDAS (WEBHOOK) — mandar dados PARA a plataforma',
    endpoints: [
      { method: 'POST', path: '/webhooks/diggionpay/:integrationId', desc: 'DiggionPay envia a venda (order.completed). Rastreamento vai em metadata. Assinatura em X-Webhook-Signature (HMAC-SHA256).', auth: 'HMAC',
        body: '{\n  "event": "order.completed",\n  "event_id": "550e8400-…",\n  "order_id": 456,\n  "amount": 97.90,\n  "status": "completed",\n  "payment_method": "pix",\n  "email": "cliente@exemplo.com",\n  "metadata": {\n    "utm_campaign": "black-friday",\n    "fbclid": "IwAR…"\n  }\n}',
        resp: '{ "received": true, "saved": true, "duplicate": false }' },
      { method: 'POST', path: '/webhooks/:provider/:integrationId', desc: 'Formato genérico (outros gateways). Aceita campos planos ou aninhados.', auth: 'HMAC do gateway',
        body: '{ "id": "venda_123", "amount": 197, "status": "paid", "utm_campaign": "x", "fbclid": "…" }' },
    ],
  },
  {
    title: 'PUXAR DADOS — ler da plataforma',
    endpoints: [
      { method: 'GET', path: '/dashboard/kpis?period=30d', desc: 'KPIs do período (receita, ROI, ROAS…)', auth: 'Bearer',
        resp: '{ "kpis": { "receitaBruta": 5000, "roas": 4.03, … }, "variations": {…}, "hasData": true }' },
      { method: 'GET', path: '/dashboard/campaigns?period=30d', desc: 'Receita/vendas por campanha (utm_campaign)', auth: 'Bearer',
        resp: '[ { "campanha": "black-friday", "receita": 594, "conversoes": 2, … } ]' },
      { method: 'GET', path: '/integrations', desc: 'Contas de anúncio e gateways conectados', auth: 'Bearer' },
      { method: 'GET', path: '/activity', desc: 'Log de atividade da API (requisições + webhooks)', auth: 'Bearer' },
    ],
  },
  {
    title: 'CONFIGURAR',
    endpoints: [
      { method: 'POST', path: '/integrations', desc: 'Conecta uma conta (Meta, Stripe…)', auth: 'Bearer',
        body: '{ "providerCode": "meta_ads", "name": "Meta — BM Principal" }' },
      { method: 'POST', path: '/integrations/:id/credentials', desc: 'Salva credenciais (cifradas AES-256)', auth: 'Bearer' },
      { method: 'POST', path: '/finance/rules', desc: 'Cria regra de imposto/taxa/custo', auth: 'Bearer',
        body: '{ "kind": "TAX", "name": "Simples", "calcType": "PERCENT", "value": 0.06 }' },
    ],
  },
];

const methodColor: Record<string, string> = { GET: 'get', POST: 'post', DELETE: 'del', PUT: 'put' };

export default function ApiDocsPage() {
  return (
    <div>
      <p className="lead">
        A plataforma expõe uma API REST. Você <b>puxa dados</b> (KPIs, campanhas, vendas)
        e <b>manda dados</b> (webhooks de venda) por HTTP. Autentique-se em{' '}
        <code>POST /auth/login</code> e envie o <code>accessToken</code> no header{' '}
        <code>Authorization: Bearer &lt;token&gt;</code>.
      </p>

      <div className="callout">
        <div>
          <strong>Documentação interativa (Swagger)</strong>
          <p>Todos os endpoints, testáveis direto no navegador, sempre sincronizados com o código.</p>
        </div>
        <a className="swagger" href={`${API}/api/docs`} target="_blank" rel="noreferrer">Abrir /api/docs →</a>
      </div>

      <div className="base">
        <span>BASE URL</span>
        <code>{API}</code>
      </div>

      {GROUPS.map((g) => (
        <section className="group" key={g.title}>
          <h3>{g.title}</h3>
          {g.endpoints.map((e) => (
            <div className="ep" key={e.path + e.method}>
              <div className="ep-head">
                <span className={`m ${methodColor[e.method]}`}>{e.method}</span>
                <code className="epath">{e.path}</code>
                <span className="auth">{e.auth}</span>
              </div>
              <p className="edesc">{e.desc}</p>
              {e.body && (
                <div className="code"><span className="clabel">request</span><pre>{e.body}</pre></div>
              )}
              {e.resp && (
                <div className="code"><span className="clabel">response</span><pre>{e.resp}</pre></div>
              )}
            </div>
          ))}
        </section>
      ))}

      <style jsx>{`
        .lead { color: #8a938a; font-size: 12.5px; line-height: 1.7; max-width: 80ch; margin: 0 0 20px; }
        .lead b { color: #b6ff3d; font-weight: 500; }
        .lead code, .base code, .epath { font-family: inherit; }
        code { background: #141715; color: #a98f6a; padding: 1px 6px; border-radius: 2px; font-size: 12px; }
        .callout { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #101a0c; border: 1px solid #23301a; border-radius: 6px; padding: 16px 18px; margin-bottom: 16px; }
        .callout strong { color: #eef3e8; font-size: 13.5px; }
        .callout p { margin: 4px 0 0; color: #8a938a; font-size: 12px; }
        .swagger { background: #b6ff3d; color: #0b0d0c; text-decoration: none; padding: 9px 16px; border-radius: 2px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .base { display: flex; align-items: center; gap: 12px; margin-bottom: 26px; font-size: 11px; color: #6d766c; letter-spacing: 0.1em; }
        .group { margin-bottom: 30px; }
        h3 { font-size: 10.5px; letter-spacing: 0.16em; color: #6d766c; margin: 0 0 12px; border-bottom: 1px solid #1c211d; padding-bottom: 8px; }
        .ep { border: 1px solid #1c211d; border-radius: 6px; padding: 14px 16px; margin-bottom: 10px; background: #0e100f; }
        .ep-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .m { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 2px; }
        .m.get { color: #b6ff3d; background: #16220a; }
        .m.post { color: #6db3ff; background: #0e1f30; }
        .m.del { color: #ff6a5a; background: #240f0c; }
        .m.put { color: #e0a83d; background: #2a2410; }
        .epath { color: #eef3e8; font-size: 13px; }
        .auth { margin-left: auto; font-size: 10.5px; color: #6d766c; }
        .edesc { color: #8a938a; font-size: 12px; margin: 8px 0 0; }
        .code { margin-top: 10px; }
        .clabel { font-size: 9.5px; letter-spacing: 0.14em; color: #5f685f; }
        pre { margin: 4px 0 0; background: #070807; border: 1px solid #1c211d; border-radius: 4px; padding: 10px 12px; font-family: inherit; font-size: 11.5px; color: #c3ccd6; overflow-x: auto; white-space: pre; }
      `}</style>
    </div>
  );
}
