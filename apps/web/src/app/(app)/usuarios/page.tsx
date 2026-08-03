'use client';

import { useState } from 'react';

interface Member { id: string; email: string; role: string; status: 'ativo' | 'convidado'; }

const ROLES = [
  ['ADMIN_EMPRESA', 'Administrador'],
  ['FINANCEIRO', 'Financeiro'],
  ['GESTOR', 'Gestor'],
  ['ANALISTA', 'Analista'],
  ['OPERADOR', 'Operador'],
  ['VISUALIZADOR', 'Visualizador'],
] as const;

const ROLE_LABEL = Object.fromEntries(ROLES) as Record<string, string>;

export default function UsuariosPage() {
  const [members, setMembers] = useState<Member[]>([
    { id: '1', email: 'thiago@sistemautomacao.com', role: 'ADMIN_EMPRESA', status: 'ativo' },
    { id: '2', email: 'financeiro@empresa.com', role: 'FINANCEIRO', status: 'ativo' },
    { id: '3', email: 'gestor@empresa.com', role: 'GESTOR', status: 'ativo' },
  ]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ANALISTA');
  const [toast, setToast] = useState('');

  function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setMembers((prev) => [...prev, { id: Date.now().toString(), email, role, status: 'convidado' }]);
    setToast(`Convite enviado para ${email}.`);
    setEmail('');
    setTimeout(() => setToast(''), 3000);
  }

  function changeRole(id: string, r: string) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: r } : m)));
  }

  function remove(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div>
      <p className="lead">
        Gerencie quem acessa a empresa e o que cada um pode ver. Os papéis controlam
        as permissões (RBAC) — ex.: Operador não vê financeiro; Visualizador só lê.
      </p>

      <section className="block">
        <h3>CONVIDAR</h3>
        <form onSubmit={invite} className="invite">
          <input type="email" placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="primary" type="submit">Enviar convite →</button>
        </form>
      </section>

      <section className="block">
        <h3>MEMBROS</h3>
        <table>
          <thead><tr><th>E-MAIL</th><th>PAPEL</th><th>STATUS</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="strong">{m.email}</td>
                <td>
                  <select className="role-sel" value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                    {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td><span className={`badge ${m.status}`}>{m.status === 'ativo' ? '● ativo' : '○ convidado'}</span></td>
                <td className="right"><button className="x" onClick={() => remove(m.id)}>✕</button></td>
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
        .invite { display: flex; gap: 8px; flex-wrap: wrap; }
        .invite input { flex: 1; min-width: 220px; }
        input, select { background: #070807; border: 1px solid #232823; color: #eef3e8; padding: 9px 12px; border-radius: 2px; font-family: inherit; font-size: 12.5px; outline: none; }
        input:focus, select:focus { border-color: #b6ff3d; }
        .primary { background: #b6ff3d; color: #0b0d0c; border: none; padding: 9px 15px; border-radius: 2px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; letter-spacing: 0.12em; color: #5f685f; padding: 8px 12px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        td { padding: 11px 12px; border-bottom: 1px solid #141715; font-size: 13px; }
        .strong { color: #eef3e8; }
        .role-sel { padding: 5px 8px; font-size: 12px; }
        .right { text-align: right; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 2px; }
        .badge.ativo { color: #b6ff3d; background: #16220a; }
        .badge.convidado { color: #e0a83d; background: #2a2410; }
        .x { background: none; border: none; color: #5f685f; cursor: pointer; font-size: 13px; }
        .x:hover { color: #ff6a5a; }
        .toast { position: fixed; bottom: 24px; right: 24px; background: #141a10; border: 1px solid #23301a; color: #b6ff3d; padding: 12px 18px; border-radius: 3px; font-size: 12.5px; }
      `}</style>
    </div>
  );
}
