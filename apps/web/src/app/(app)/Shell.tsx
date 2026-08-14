'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

const NAV: Array<[string, string, string]> = [
  ['/dashboard', 'Dashboard', '▣'],
  ['/integracoes', 'Integrações', '◈'],
  ['/financeiro', 'Financeiro', '₪'],
  ['/webhooks', 'Webhooks', '⇄'],
  ['/atividade', 'Atividade', '≋'],
  ['/api-docs', 'API / Docs', '⌘'],
  ['/usuarios', 'Usuários', '⊙'],
];

function readRole(): string {
  try {
    const t = localStorage.getItem('token');
    if (!t) return '';
    return JSON.parse(atob(t.split('.')[1])).role ?? '';
  } catch { return ''; }
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [clock, setClock] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      router.replace('/login');
      return;
    }
    const role = readRole();
    setIsMaster(role === 'ADMIN_GERAL');
    setImpersonating(!!localStorage.getItem('masterToken'));
  }, [router, pathname]);

  function exitImpersonation() {
    const mt = localStorage.getItem('masterToken');
    if (mt) {
      localStorage.setItem('token', mt);
      localStorage.removeItem('masterToken');
      router.replace('/master');
    }
  }

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('pt-BR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function logout() {
    localStorage.removeItem('token');
    router.replace('/login');
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          TRAFFIC<b>INTEL</b>
        </div>
        <nav>
          {NAV.map(([href, label, icon]) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={active ? 'nav on' : 'nav'}>
                <span className="ic">{icon}</span>
                {label}
              </Link>
            );
          })}
          {isMaster && (
            <Link href="/master" className={pathname === '/master' ? 'nav on master' : 'nav master'}>
              <span className="ic">★</span>
              Master
            </Link>
          )}
        </nav>
        <button className="logout" onClick={logout}>
          ⏻ Sair
        </button>
      </aside>

      <div className="main">
        {impersonating && (
          <div className="imp-bar">
            <span>⚠ Você está acessando uma empresa como Administrador Geral (modo suporte).</span>
            <button onClick={exitImpersonation}>← Voltar ao Painel Master</button>
          </div>
        )}
        <header className="top">
          <span className="crumb">
            {pathname === '/master' ? 'Painel Master' : NAV.find(([h]) => h === pathname)?.[1] ?? ''}
          </span>
          <div className="top-r">
            <span className="tenant">◧ Minha Empresa</span>
            <span className="clock">{clock}</span>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>

      <style jsx>{`
        .app {
          display: grid;
          grid-template-columns: 220px 1fr;
          min-height: 100vh;
          background: #0b0d0c;
          color: #d7dcd4;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          font-size: 13px;
        }
        .side {
          background: #0e100f;
          border-right: 1px solid #1c211d;
          display: flex;
          flex-direction: column;
          padding: 18px 14px;
        }
        .brand {
          font-size: 15px;
          letter-spacing: 0.14em;
          color: #e8ede4;
          padding: 4px 8px 20px;
          font-weight: 500;
        }
        .brand b {
          color: #b6ff3d;
          font-weight: 700;
        }
        nav {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1;
        }
        :global(.side .nav) {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 9px 10px;
          color: #8a938a;
          text-decoration: none;
          border-radius: 3px;
          letter-spacing: 0.03em;
          border: 1px solid transparent;
        }
        :global(.side .nav:hover) {
          background: #141715;
          color: #d7dcd4;
        }
        :global(.side .nav.on) {
          background: #141a10;
          color: #b6ff3d;
          border-color: #23301a;
        }
        .ic {
          width: 16px;
          text-align: center;
          opacity: 0.9;
        }
        .logout {
          background: none;
          border: 1px solid #232823;
          color: #8a938a;
          padding: 9px;
          border-radius: 3px;
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
          letter-spacing: 0.05em;
        }
        .logout:hover {
          border-color: #3a2a2a;
          color: #ff6a5a;
        }
        :global(.side .nav.master) { margin-top: 8px; border-top: 1px solid #1c211d; padding-top: 14px; color: #b6ff3d; }
        .main {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .imp-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: #2a2410; border-bottom: 1px solid #4a3c14; color: #e0a83d;
          padding: 9px 22px; font-size: 12px;
        }
        .imp-bar button {
          background: none; border: 1px solid #4a3c14; color: #e0a83d;
          padding: 5px 12px; border-radius: 2px; font-family: inherit; font-size: 11.5px; cursor: pointer;
        }
        .imp-bar button:hover { border-color: #e0a83d; }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 22px;
          border-bottom: 1px solid #1c211d;
          background: #0e100f;
        }
        .crumb {
          font-size: 13px;
          letter-spacing: 0.08em;
          color: #e8ede4;
        }
        .top-r {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .tenant {
          font-size: 12px;
          color: #8a938a;
          letter-spacing: 0.04em;
        }
        .clock {
          font-size: 12.5px;
          color: #6d766c;
          font-variant-numeric: tabular-nums;
        }
        .content {
          flex: 1;
          padding: 24px 22px;
          overflow-x: auto;
        }
        @media (max-width: 720px) {
          .app {
            grid-template-columns: 1fr;
          }
          .side {
            flex-direction: row;
            align-items: center;
            padding: 10px;
            overflow-x: auto;
          }
          .brand {
            padding: 4px 8px;
          }
          nav {
            flex-direction: row;
          }
          .logout {
            white-space: nowrap;
          }
        }
      `}</style>
    </div>
  );
}
