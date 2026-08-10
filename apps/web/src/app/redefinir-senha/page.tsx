'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('> link inválido — solicite um novo');
      return;
    }
    if (newPassword.length < 8) {
      setError('> senha precisa de ao menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('> as senhas não conferem');
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      if (!r.ok) {
        setError('> link inválido ou expirado — solicite um novo');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError('> não foi possível redefinir a senha (backend offline?)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="scr">
      <div className="panel">
        <div className="head">
          <span className="mark">TRAFFIC<b>INTEL</b></span>
          <span className="sub">REDEFINIR SENHA</span>
        </div>

        <div className="body">
          {success ? (
            <div className="sentBox">
              <p className="sentMsg">Senha redefinida com sucesso. Redirecionando para o login…</p>
              <p className="alt">
                <Link href="/login">ir para o login agora</Link>
              </p>
            </div>
          ) : !token ? (
            <div className="sentBox">
              <p className="err">{'> link inválido ou incompleto'}</p>
              <p className="alt">
                <Link href="/esqueci-senha">solicitar novo link</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>NOVA SENHA · MÍN. 8 CARACTERES</label>
                <input
                  type="password" value={newPassword} autoComplete="new-password"
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••" autoFocus
                />
              </div>
              <div className="field">
                <label>CONFIRMAR NOVA SENHA</label>
                <input
                  type="password" value={confirmPassword} autoComplete="new-password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••"
                />
              </div>
              {error && <p className="err">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? 'REDEFININDO…' : 'REDEFINIR SENHA →'}
              </button>
              <p className="alt">
                <Link href="/login">← voltar ao login</Link>
              </p>
            </form>
          )}
        </div>

        <div className="foot">
          <span className="lock">◈ CANAL SEGURO</span>
          <span>AES-256 · JWT · 2FA</span>
        </div>
      </div>

      <style jsx>{`
        .scr {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          background:
            repeating-linear-gradient(0deg, transparent 0 2px, rgba(182,255,61,0.012) 2px 3px),
            #0b0d0c;
          font-family: var(--font-mono), ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .panel {
          width: 100%; max-width: 400px;
          background: #0e100f;
          border: 1px solid #232823;
          border-radius: 3px;
          overflow: hidden;
          box-shadow: 0 0 0 1px #0b0d0c, 0 24px 70px rgba(0,0,0,0.55);
        }
        .head {
          padding: 20px 22px 16px;
          border-bottom: 1px solid #1c211d;
          display: flex; flex-direction: column; gap: 5px;
        }
        .mark { font-size: 17px; letter-spacing: 0.16em; color: #e8ede4; font-weight: 500; }
        .mark b { color: #b6ff3d; font-weight: 700; }
        .sub { font-size: 10.5px; letter-spacing: 0.24em; color: #5f685f; }
        .body { padding: 22px; }
        form { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 7px; }
        label { font-size: 10px; letter-spacing: 0.18em; color: #6d766c; }
        input {
          background: #070807; border: 1px solid #232823;
          color: #eef3e8; font-family: inherit; font-size: 14px;
          padding: 11px 12px; border-radius: 2px; outline: none;
          letter-spacing: 0.03em;
        }
        input:focus { border-color: #b6ff3d; box-shadow: 0 0 0 1px #b6ff3d55; }
        button[type='submit'] {
          background: #b6ff3d; color: #0b0d0c;
          border: none; border-radius: 2px; padding: 12px;
          font-family: inherit; font-size: 12.5px; font-weight: 700;
          letter-spacing: 0.1em; cursor: pointer; transition: filter 0.12s;
        }
        button[type='submit']:hover { filter: brightness(1.1); }
        button[type='submit']:disabled { opacity: 0.5; cursor: default; }
        .err { margin: 0; color: #ff6a5a; font-size: 12px; letter-spacing: 0.04em; }
        .alt { margin: 0; font-size: 11.5px; color: #6d766c; text-align: center; }
        :global(.alt a) { color: #b6ff3d; text-decoration: none; }
        :global(.alt a:hover) { text-decoration: underline; }
        .sentBox { display: flex; flex-direction: column; gap: 16px; }
        .sentMsg { margin: 0; font-size: 12.5px; color: #d7dcd4; line-height: 1.6; }
        .foot {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 22px; border-top: 1px solid #1c211d;
          font-size: 10px; letter-spacing: 0.1em; color: #4c544c;
        }
        .lock { color: #6d766c; }
      `}</style>
    </main>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaForm />
    </Suspense>
  );
}
