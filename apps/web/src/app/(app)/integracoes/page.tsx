'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface Integration {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISABLED';
  lastSyncAt: string | null;
  provider: { code: string; category: 'ads' | 'gateway' };
}

interface MetaAccount {
  id: string;
  accountId: string;
  name: string;
  currency: string | null;
  accountStatus: number | null;
  isActive: boolean;
  lastSyncAt: string | null;
}

// Catálogo pré-preparado (BLUEPRINT seção 4.2). meta_ads já tem connector real;
// os demais seguem placeholder até a integração real entrar.
const CATALOG: Array<{ code: string; name: string; category: 'ads' | 'gateway'; fields: string[]; hint?: string }> = [
  { code: 'meta_ads', name: 'Meta Ads', category: 'ads', fields: ['accessToken'], hint: 'Cole o token de acesso (System User ou token de longa duração) com permissão ads_read.' },
  { code: 'google_ads', name: 'Google Ads', category: 'ads', fields: ['developerToken', 'customerId'] },
  { code: 'tiktok_ads', name: 'TikTok Ads', category: 'ads', fields: ['accessToken', 'advertiserId'] },
  { code: 'diggionpay', name: 'DiggionPay', category: 'gateway', fields: ['publicKey', 'secretKey', 'webhookSecret'] },
  { code: 'stripe', name: 'Stripe', category: 'gateway', fields: ['secretKey'] },
  { code: 'mercadopago', name: 'Mercado Pago', category: 'gateway', fields: ['accessToken'] },
  { code: 'hotmart', name: 'Hotmart', category: 'gateway', fields: ['clientId', 'clientSecret'] },
];

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

export default function IntegracoesPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<(typeof CATALOG)[0] | null>(null);
  const [name, setName] = useState('');
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [accountsByIntegration, setAccountsByIntegration] = useState<Record<string, MetaAccount[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/integrations`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const rows = (await res.json()) as Integration[];
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openModal(provider: (typeof CATALOG)[0]) {
    setModal(provider);
    const count = items.filter((i) => i.provider.code === provider.code).length;
    setName(count > 0 ? `${provider.name} — conta ${count + 1}` : provider.name);
    setCreds({});
    setError('');
  }

  async function saveCredentials() {
    if (!modal || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const createRes = await fetch(`${API}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ providerCode: modal.code, name: name.trim() }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.message ?? 'Falha ao criar integração');
      }
      const integration = await createRes.json();

      const credRes = await fetch(`${API}/integrations/${integration.id}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ credentials: creds }),
      });
      if (!credRes.ok) {
        const body = await credRes.json().catch(() => ({}));
        throw new Error(body.message ?? 'Credenciais inválidas');
      }

      setToast(`"${name.trim()}" conectada. Sincronização iniciada.`);
      setModal(null);
      await load();
      // Dispara "atualizar agora" pra popular as contas/campanhas na hora.
      await updateNow(integration.id, name.trim());
      setTimeout(() => setToast(''), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao conectar');
    } finally {
      setSaving(false);
    }
  }

  async function updateNow(id: string, label: string) {
    setToast(`Sincronizando ${label}…`);
    try {
      await fetch(`${API}/sync/integrations/${id}/now`, { method: 'POST', headers: authHeaders() });
      setTimeout(() => { load(); if (expanded === id) loadMetaAccounts(id); }, 4000);
    } catch { /* ignore */ }
    setTimeout(() => setToast(''), 2500);
  }

  async function loadMetaAccounts(id: string) {
    try {
      const res = await fetch(`${API}/integrations/${id}/meta-accounts`, { headers: authHeaders() });
      if (!res.ok) return;
      const rows = (await res.json()) as MetaAccount[];
      setAccountsByIntegration((prev) => ({ ...prev, [id]: rows }));
    } catch { /* ignore */ }
  }

  function toggleExpand(item: Integration) {
    if (expanded === item.id) { setExpanded(null); return; }
    setExpanded(item.id);
    if (item.provider.code === 'meta_ads') loadMetaAccounts(item.id);
  }

  async function remove(id: string) {
    try {
      await fetch(`${API}/integrations/${id}`, { method: 'DELETE', headers: authHeaders() });
      await load();
    } catch { /* ignore */ }
  }

  return (
    <div>
      <p className="lead">
        Conecte quantas contas precisar — inclusive <b>várias contas do mesmo provedor</b>
        {' '}(BMs e contas de anúncio diferentes). Cada uma tem seu próprio apelido e credenciais,
        criptografadas (AES-256), e sincroniza automaticamente a cada 15 minutos.
      </p>

      <section className="block">
        <div className="block-head">
          <h3>CONTAS CONECTADAS · {items.length}</h3>
        </div>
        {loading ? (
          <p className="dim">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="dim">Nenhuma conta conectada ainda.</p>
        ) : (
          <table>
            <thead>
              <tr><th>APELIDO</th><th>PROVEDOR</th><th>STATUS</th><th>ÚLTIMA SINC.</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <React.Fragment key={i.id}>
                  <tr>
                    <td className="strong clickable" onClick={() => toggleExpand(i)}>
                      {i.provider.code === 'meta_ads' ? (expanded === i.id ? '▾ ' : '▸ ') : ''}{i.name}
                    </td>
                    <td className="dim">{i.provider.code} · {i.provider.category === 'ads' ? 'Anúncios' : 'Gateway'}</td>
                    <td>
                      <span className={`badge ${i.status.toLowerCase()}`}>
                        {i.status === 'ACTIVE' ? '● ativo' : i.status === 'PENDING' ? '○ pendente' : i.status === 'DISABLED' ? '○ desativado' : '✕ erro'}
                      </span>
                    </td>
                    <td className="dim">{timeAgo(i.lastSyncAt)}</td>
                    <td className="right">
                      <button className="ghost" onClick={() => updateNow(i.id, i.name)} disabled={i.status !== 'ACTIVE'}>↻ Atualizar</button>
                      <button className="x" onClick={() => remove(i.id)}>✕</button>
                    </td>
                  </tr>
                  {expanded === i.id && i.provider.code === 'meta_ads' && (
                    <tr>
                      <td colSpan={5} className="detail">
                        {(accountsByIntegration[i.id]?.length ?? 0) === 0 ? (
                          <span className="dim">Nenhuma conta de anúncio encontrada ainda (aguarde a sincronização).</span>
                        ) : (
                          <div className="accounts">
                            {accountsByIntegration[i.id]!.map((a) => (
                              <div className="acc" key={a.id}>
                                <span className="acc-name">{a.name}</span>
                                <span className="acc-id dim">{a.accountId}</span>
                                <span className="acc-cur dim">{a.currency ?? ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="block">
        <h3>ADICIONAR CONTA</h3>
        <div className="catalog">
          {CATALOG.map((p) => (
            <button key={p.code} className="prov" onClick={() => openModal(p)}>
              <span className="prov-name">{p.name}</span>
              <span className="prov-cat">{p.category === 'ads' ? 'Anúncios' : 'Gateway'}</span>
              <span className="prov-add">+ conectar conta</span>
            </button>
          ))}
        </div>
      </section>

      {modal && (
        <div className="overlay" onClick={() => !saving && setModal(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Conectar conta {modal.name}</h4>
            <p className="dialog-sub">Dê um apelido para identificar esta conta e cole suas credenciais.</p>
            <label>
              apelido desta conta
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Meta — BM Cliente X" autoFocus />
            </label>
            {modal.fields.map((f) => (
              <label key={f}>
                {f}
                <input type="password" value={creds[f] ?? ''} onChange={(e) => setCreds({ ...creds, [f]: e.target.value })} placeholder={`${f}…`} />
              </label>
            ))}
            {modal.hint && <p className="tip">{modal.hint}</p>}
            {error && <p className="err">{error}</p>}
            <div className="dialog-actions">
              <button className="ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</button>
              <button className="primary" onClick={saveCredentials} disabled={saving}>
                {saving ? 'Validando…' : 'Conectar e sincronizar →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <style jsx>{`
        .lead { color: #8a938a; font-size: 12.5px; line-height: 1.6; max-width: 74ch; margin: 0 0 26px; }
        .lead b { color: #b6ff3d; font-weight: 500; }
        .block { margin-bottom: 30px; }
        .block-head { display: flex; align-items: center; justify-content: space-between; }
        h3 { font-size: 10.5px; letter-spacing: 0.2em; color: #6d766c; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; letter-spacing: 0.12em; color: #5f685f; padding: 8px 12px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        td { padding: 12px; border-bottom: 1px solid #141715; font-size: 13px; }
        .strong { color: #eef3e8; }
        .clickable { cursor: pointer; }
        .dim { color: #7f887e; }
        .right { text-align: right; white-space: nowrap; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 2px; }
        .badge.active { color: #b6ff3d; background: #16220a; }
        .badge.pending { color: #e0a83d; background: #2a2410; }
        .badge.error { color: #ff6a5a; background: #240f0c; }
        .badge.disabled { color: #7f887e; background: #171917; }
        .ghost { background: none; border: 1px solid #232823; color: #97a097; padding: 6px 12px; border-radius: 2px; font-family: inherit; font-size: 11.5px; cursor: pointer; margin-right: 6px; }
        .ghost:hover:not(:disabled) { border-color: #3a4239; color: #d7dcd4; }
        .ghost:disabled { opacity: 0.35; cursor: default; }
        .x { background: none; border: none; color: #5f685f; cursor: pointer; font-size: 13px; }
        .x:hover { color: #ff6a5a; }
        .detail { background: #0a0c0a; }
        .accounts { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
        .acc { display: flex; gap: 14px; align-items: baseline; font-size: 12px; }
        .acc-name { color: #d7dcd4; }
        .catalog { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .prov { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; background: #0e100f; border: 1px solid #1c211d; border-radius: 4px; padding: 14px 16px; cursor: pointer; font-family: inherit; text-align: left; }
        .prov:hover { border-color: #2a3326; }
        .prov-name { color: #eef3e8; font-size: 13.5px; }
        .prov-cat { color: #6d766c; font-size: 11px; }
        .prov-add { color: #b6ff3d; font-size: 11px; margin-top: 4px; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
        .dialog { background: #0e100f; border: 1px solid #232823; border-radius: 5px; width: 100%; max-width: 420px; padding: 24px; }
        h4 { margin: 0 0 4px; font-size: 15px; color: #eef3e8; letter-spacing: 0.04em; }
        .dialog-sub { margin: 0 0 18px; font-size: 12px; color: #8a938a; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #97a097; margin-bottom: 14px; letter-spacing: 0.04em; }
        input { background: #070807; border: 1px solid #232823; color: #eef3e8; padding: 10px 12px; border-radius: 2px; font-family: inherit; font-size: 13px; outline: none; }
        input:focus { border-color: #b6ff3d; }
        .tip { font-size: 11px; color: #6d766c; line-height: 1.5; margin: 0 0 14px; }
        .err { font-size: 12px; color: #ff6a5a; margin: 0 0 14px; }
        .dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .primary { background: #b6ff3d; color: #0b0d0c; border: none; padding: 9px 14px; border-radius: 2px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: 0.04em; }
        .primary:disabled { opacity: 0.5; cursor: default; }
        .toast { position: fixed; bottom: 24px; right: 24px; background: #141a10; border: 1px solid #23301a; color: #b6ff3d; padding: 12px 18px; border-radius: 3px; font-size: 12.5px; z-index: 60; }
      `}</style>
    </div>
  );
}
