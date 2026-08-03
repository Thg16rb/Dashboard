'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface Tenant {
  id: string; name: string; slug: string; plan: string; status: string;
  usuarios: number; integracoes: number; createdAt: string;
}
interface Stats { empresas: number; usuarios: number; integracoes: number; sincronizacoes: number; }

function roleFromToken(): string {
  try {
    const t = localStorage.getItem('token');
    if (!t || t === 'demo') return 'demo';
    const p = JSON.parse(atob(t.split('.')[1]));
    return p.role ?? '';
  } catch { return ''; }
}

export default function MasterPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [toast, setToast] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const r = roleFromToken();
    setRole(r);
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    if (r === 'demo') {
      // Demonstração quando não há backend/ADMIN_GERAL real
      setStats({ empresas: 3, usuarios: 8, integracoes: 12, sincronizacoes: 420 });
      setTenants([
        { id: '1', name: 'Studio X Marketing', slug: 'studio-x', plan: 'pro', status: 'active', usuarios: 4, integracoes: 5, createdAt: '2026-07-20' },
        { id: '2', name: 'Loja Verão', slug: 'loja-verao', plan: 'free', status: 'active', usuarios: 2, integracoes: 3, createdAt: '2026-07-28' },
        { id: '3', name: 'Agência RYGO', slug: 'rygo', plan: 'pro', status: 'active', usuarios: 2, integracoes: 4, createdAt: '2026-08-01' },
      ]);
      return;
    }

    fetch(`${API}/master/stats`, { headers }).then((x) => x.ok ? x.json() : null).then(setStats).catch(() => {});
    fetch(`${API}/master/tenants`, { headers }).then((x) => x.ok ? x.json() : []).then(setTenants).catch(() => setTenants([]));
  }, []);

  async function impersonate(t: Tenant) {
    if (role === 'demo') {
      setToast(`(demo) entraria na empresa "${t.name}"`);
      setTimeout(() => setToast(''), 3000);
      return;
    }
    const token = localStorage.getItem('token');
    const r = await fetch(`${API}/master/impersonate/${t.id}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (r.ok) {
      const data = await r.json();
      localStorage.setItem('masterToken', token ?? ''); // guarda o token do master para voltar
      localStorage.setItem('token', data.accessToken);
      router.push('/dashboard');
    } else {
      setToast('Não foi possível entrar na empresa.');
      setTimeout(() => setToast(''), 3000);
    }
  }

  const filtered = tenants.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()) || t.slug.includes(q.toLowerCase()));

  return (
    <div>
      <p className="lead">
        Painel do Administrador Geral — visão de todas as empresas da plataforma.
        Você pode <b>entrar em qualquer empresa</b> para dar suporte e resolver problemas.
      </p>

      {stats && (
        <div className="stats">
          <div className="stat"><span>{stats.empresas}</span>empresas</div>
          <div className="stat"><span>{stats.usuarios}</span>usuários</div>
          <div className="stat"><span>{stats.integracoes}</span>integrações</div>
          <div className="stat"><span>{stats.sincronizacoes}</span>sincronizações</div>
        </div>
      )}

      <div className="bar">
        <h3>EMPRESAS</h3>
        <input className="search" placeholder="Buscar empresa…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="doc-scroll">
      <table>
        <thead><tr><th>EMPRESA</th><th>PLANO</th><th>STATUS</th><th className="num">USUÁRIOS</th><th className="num">INTEGR.</th><th></th></tr></thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={6} className="empty">Nenhuma empresa.</td></tr>}
          {filtered.map((t) => (
            <tr key={t.id}>
              <td className="strong">{t.name}<span className="slug"> /{t.slug}</span></td>
              <td><span className={`plan ${t.plan}`}>{t.plan}</span></td>
              <td><span className="badge active">● {t.status}</span></td>
              <td className="num">{t.usuarios}</td>
              <td className="num">{t.integracoes}</td>
              <td className="right"><button className="enter" onClick={() => impersonate(t)}>→ Entrar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <style jsx>{`
        .lead { color: #8a938a; font-size: 12.5px; line-height: 1.6; max-width: 74ch; margin: 0 0 22px; }
        .lead b { color: #b6ff3d; font-weight: 500; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 26px; }
        @media (max-width: 560px) { .stats { grid-template-columns: repeat(2, 1fr); } }
        .stat { background: #0e100f; border: 1px solid #1c211d; border-radius: 6px; padding: 16px; display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #7f887e; text-transform: uppercase; letter-spacing: 0.08em; }
        .stat span { font-size: 26px; color: #eef3e8; font-weight: 600; font-variant-numeric: tabular-nums; }
        .bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        h3 { font-size: 10.5px; letter-spacing: 0.2em; color: #6d766c; margin: 0; }
        .search { background: #070807; border: 1px solid #232823; color: #eef3e8; padding: 8px 12px; border-radius: 2px; font-family: inherit; font-size: 12.5px; outline: none; width: 220px; }
        .search:focus { border-color: #b6ff3d; }
        .doc-scroll { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 640px; }
        th { text-align: left; font-size: 10px; letter-spacing: 0.1em; color: #5f685f; padding: 8px 12px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        td { padding: 12px; border-bottom: 1px solid #141715; font-size: 13px; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .right { text-align: right; }
        .strong { color: #eef3e8; } .slug { color: #5f685f; font-size: 11px; }
        .empty { color: #6d766c; text-align: center; }
        .plan { font-size: 11px; padding: 2px 8px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
        .plan.pro { color: #b6ff3d; background: #16220a; }
        .plan.free { color: #8a938a; background: #16191a; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 2px; }
        .badge.active { color: #b6ff3d; background: #16220a; }
        .enter { background: #b6ff3d; color: #0b0d0c; border: none; padding: 6px 14px; border-radius: 2px; font-family: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .enter:hover { filter: brightness(1.1); }
        .toast { position: fixed; bottom: 24px; right: 24px; background: #141a10; border: 1px solid #23301a; color: #b6ff3d; padding: 12px 18px; border-radius: 3px; font-size: 12.5px; }
      `}</style>
    </div>
  );
}
