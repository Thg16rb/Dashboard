'use client';

import { useState } from 'react';

interface Integration {
  id: string;
  provider: string;
  category: 'ads' | 'gateway';
  status: 'ACTIVE' | 'PENDING' | 'ERROR';
  lastSync: string | null;
}

// Catálogo pré-preparado (BLUEPRINT seção 4.2). Em produção vem de /integrations/providers.
const CATALOG: Array<{ code: string; name: string; category: 'ads' | 'gateway'; fields: string[] }> = [
  { code: 'meta_ads', name: 'Meta Ads', category: 'ads', fields: ['accessToken', 'adAccountId'] },
  { code: 'google_ads', name: 'Google Ads', category: 'ads', fields: ['developerToken', 'customerId'] },
  { code: 'tiktok_ads', name: 'TikTok Ads', category: 'ads', fields: ['accessToken', 'advertiserId'] },
  { code: 'stripe', name: 'Stripe', category: 'gateway', fields: ['secretKey'] },
  { code: 'mercadopago', name: 'Mercado Pago', category: 'gateway', fields: ['accessToken'] },
  { code: 'hotmart', name: 'Hotmart', category: 'gateway', fields: ['clientId', 'clientSecret'] },
];

export default function IntegracoesPage() {
  const [items, setItems] = useState<Integration[]>([
    { id: '1', provider: 'Meta Ads', category: 'ads', status: 'ACTIVE', lastSync: 'há 8 min' },
    { id: '2', provider: 'Stripe', category: 'gateway', status: 'ACTIVE', lastSync: 'há 3 min' },
    { id: '3', provider: 'Google Ads', category: 'ads', status: 'PENDING', lastSync: null },
  ]);
  const [modal, setModal] = useState<(typeof CATALOG)[0] | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');

  function openModal(provider: (typeof CATALOG)[0]) {
    setModal(provider);
    setCreds({});
  }

  function saveCredentials() {
    if (!modal) return;
    setItems((prev) => [
      ...prev.filter((i) => i.provider !== modal.name),
      { id: Date.now().toString(), provider: modal.name, category: modal.category, status: 'ACTIVE', lastSync: 'agora' },
    ]);
    setToast(`${modal.name} conectado. Sincronização iniciada.`);
    setModal(null);
    setTimeout(() => setToast(''), 3500);
  }

  function updateNow(name: string) {
    setToast(`Sincronizando ${name}…`);
    setItems((prev) => prev.map((i) => (i.provider === name ? { ...i, lastSync: 'agora' } : i)));
    setTimeout(() => setToast(''), 2500);
  }

  return (
    <div>
      <p className="lead">
        Conecte as plataformas de anúncios e gateways. Cada empresa usa suas próprias
        credenciais — elas são criptografadas (AES-256) e nunca exibidas de volta.
      </p>

      <section className="block">
        <h3>CONECTADAS</h3>
        <table>
          <thead>
            <tr><th>PLATAFORMA</th><th>TIPO</th><th>STATUS</th><th>ÚLTIMA SINC.</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="strong">{i.provider}</td>
                <td className="dim">{i.category === 'ads' ? 'Anúncios' : 'Gateway'}</td>
                <td>
                  <span className={`badge ${i.status.toLowerCase()}`}>
                    {i.status === 'ACTIVE' ? '● ativo' : i.status === 'PENDING' ? '○ pendente' : '✕ erro'}
                  </span>
                </td>
                <td className="dim">{i.lastSync ?? '—'}</td>
                <td className="right">
                  <button className="ghost" onClick={() => updateNow(i.provider)} disabled={i.status !== 'ACTIVE'}>
                    ↻ Atualizar Agora
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="block">
        <h3>DISPONÍVEIS</h3>
        <div className="catalog">
          {CATALOG.map((p) => (
            <button key={p.code} className="prov" onClick={() => openModal(p)}>
              <span className="prov-name">{p.name}</span>
              <span className="prov-cat">{p.category === 'ads' ? 'Anúncios' : 'Gateway'}</span>
              <span className="prov-add">+ conectar</span>
            </button>
          ))}
        </div>
      </section>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Conectar {modal.name}</h4>
            <p className="dialog-sub">Cole as credenciais da sua conta {modal.name}.</p>
            {modal.fields.map((f) => (
              <label key={f}>
                {f}
                <input
                  type="password"
                  value={creds[f] ?? ''}
                  onChange={(e) => setCreds({ ...creds, [f]: e.target.value })}
                  placeholder={`${f}…`}
                />
              </label>
            ))}
            <div className="dialog-actions">
              <button className="ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="primary" onClick={saveCredentials}>Conectar e sincronizar →</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <style jsx>{`
        .lead { color: #8a938a; font-size: 12.5px; line-height: 1.6; max-width: 70ch; margin: 0 0 26px; }
        .block { margin-bottom: 30px; }
        h3 { font-size: 10.5px; letter-spacing: 0.2em; color: #6d766c; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; letter-spacing: 0.12em; color: #5f685f; padding: 8px 12px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        td { padding: 12px; border-bottom: 1px solid #141715; font-size: 13px; }
        .strong { color: #eef3e8; }
        .dim { color: #7f887e; }
        .right { text-align: right; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 2px; }
        .badge.active { color: #b6ff3d; background: #16220a; }
        .badge.pending { color: #e0a83d; background: #2a2410; }
        .badge.error { color: #ff6a5a; background: #240f0c; }
        .ghost {
          background: none; border: 1px solid #232823; color: #97a097;
          padding: 6px 12px; border-radius: 2px; font-family: inherit; font-size: 11.5px; cursor: pointer;
        }
        .ghost:hover:not(:disabled) { border-color: #3a4239; color: #d7dcd4; }
        .ghost:disabled { opacity: 0.35; cursor: default; }
        .catalog { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .prov {
          display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
          background: #0e100f; border: 1px solid #1c211d; border-radius: 4px;
          padding: 14px 16px; cursor: pointer; font-family: inherit; text-align: left;
        }
        .prov:hover { border-color: #2a3326; }
        .prov-name { color: #eef3e8; font-size: 13.5px; }
        .prov-cat { color: #6d766c; font-size: 11px; }
        .prov-add { color: #b6ff3d; font-size: 11px; margin-top: 4px; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
        .dialog { background: #0e100f; border: 1px solid #232823; border-radius: 5px; width: 100%; max-width: 400px; padding: 24px; }
        h4 { margin: 0 0 4px; font-size: 15px; color: #eef3e8; letter-spacing: 0.04em; }
        .dialog-sub { margin: 0 0 18px; font-size: 12px; color: #8a938a; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #97a097; margin-bottom: 14px; letter-spacing: 0.04em; }
        input { background: #070807; border: 1px solid #232823; color: #eef3e8; padding: 10px 12px; border-radius: 2px; font-family: inherit; font-size: 13px; outline: none; }
        input:focus { border-color: #b6ff3d; }
        .dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
        .primary { background: #b6ff3d; color: #0b0d0c; border: none; padding: 9px 14px; border-radius: 2px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: 0.04em; }
        .toast { position: fixed; bottom: 24px; right: 24px; background: #141a10; border: 1px solid #23301a; color: #b6ff3d; padding: 12px 18px; border-radius: 3px; font-size: 12.5px; z-index: 60; }
      `}</style>
    </div>
  );
}
