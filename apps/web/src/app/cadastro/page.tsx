'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export default function CadastroPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('> senha precisa de ao menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, email, password }),
      });
      if (r.status === 409) {
        setError('> e-mail já cadastrado');
        return;
      }
      if (!r.ok) throw new Error();
      const data = await r.json();
      localStorage.setItem('token', data.accessToken);
      router.push('/dashboard');
    } catch {
      setError('> não foi possível criar a conta (backend offline?)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="scr">
      <div className="panel">
        <div className="head">
          <span className="mark">TRAFFIC<b>INTEL</b></span>
          <span className="sub">CRIAR CONTA</span>
        </div>
        <div className="body">
          <form onSubmit={handleSignup}>
            <div className="field">
              <label>NOME DA EMPRESA</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Minha Empresa Ltda" autoFocus />
            </div>
            <div className="field">
              <label>SEU E-MAIL</label>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
            </div>
            <div className="field">
              <label>SENHA · MÍN. 8 CARACTERES</label>
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" />
            </div>
            {error && <p className="err">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? 'CRIANDO CONTA…' : 'CRIAR CONTA →'}
            </button>
            <p className="alt">
              já tem conta? <Link href="/login">entrar</Link>
            </p>
          </form>
        </div>
        <div className="foot">
          <span className="lock">◈ CANAL SEGURO</span>
          <span>AES-256 · JWT · 2FA</span>
        </div>
      </div>

      <style jsx>{`
        .scr {
          min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
          background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(182,255,61,0.012) 2px 3px), #0b0d0c;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .panel { width: 100%; max-width: 400px; background: #0e100f; border: 1px solid #232823; border-radius: 3px; overflow: hidden; box-shadow: 0 0 0 1px #0b0d0c, 0 24px 70px rgba(0,0,0,0.55); }
        .head { padding: 20px 22px 16px; border-bottom: 1px solid #1c211d; display: flex; flex-direction: column; gap: 5px; }
        .mark { font-size: 17px; letter-spacing: 0.16em; color: #e8ede4; font-weight: 500; }
        .mark b { color: #b6ff3d; font-weight: 700; }
        .sub { font-size: 10.5px; letter-spacing: 0.24em; color: #5f685f; }
        .body { padding: 22px; }
        form { display: flex; flex-direction: column; gap: 15px; }
        .field { display: flex; flex-direction: column; gap: 7px; }
        label { font-size: 10px; letter-spacing: 0.16em; color: #6d766c; }
        input { background: #070807; border: 1px solid #232823; color: #eef3e8; font-family: inherit; font-size: 14px; padding: 11px 12px; border-radius: 2px; outline: none; letter-spacing: 0.03em; }
        input:focus { border-color: #b6ff3d; box-shadow: 0 0 0 1px #b6ff3d55; }
        button[type='submit'] { background: #b6ff3d; color: #0b0d0c; border: none; border-radius: 2px; padding: 12px; font-family: inherit; font-size: 12.5px; font-weight: 700; letter-spacing: 0.1em; cursor: pointer; transition: filter 0.12s; margin-top: 4px; }
        button[type='submit']:hover { filter: brightness(1.1); }
        button[type='submit']:disabled { opacity: 0.5; cursor: default; }
        .err { margin: 0; color: #ff6a5a; font-size: 12px; letter-spacing: 0.04em; }
        .alt { margin: 0; font-size: 11.5px; color: #6d766c; text-align: center; }
        :global(.alt a) { color: #b6ff3d; text-decoration: none; }
        :global(.alt a:hover) { text-decoration: underline; }
        .foot { display: flex; justify-content: space-between; align-items: center; padding: 12px 22px; border-top: 1px solid #1c211d; font-size: 10px; letter-spacing: 0.1em; color: #4c544c; }
        .lock { color: #6d766c; }
      `}</style>
    </main>
  );
}
