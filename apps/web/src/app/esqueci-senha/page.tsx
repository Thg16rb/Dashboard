'use client';

import { useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('> informe seu e-mail');
      return;
    }
    setLoading(true);
    try {
      await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Independente de erro de rede, seguimos com a mensagem genérica —
      // o backend nunca revela se o e-mail existe.
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <main className="scr">
      <div className="panel">
        <div className="head">
          <span className="mark">TRAFFIC<b>INTEL</b></span>
          <span className="sub">RECUPERAR ACESSO</span>
        </div>

        <div className="body">
          {sent ? (
            <div className="sentBox">
              <p className="sentMsg">
                Se o e-mail existir em nossa base, você receberá um link para redefinir a senha.
              </p>
              <p className="alt">
                <Link href="/login">← voltar ao login</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="hint">
                Informe o e-mail da sua conta. Enviaremos um link para redefinir a senha.
              </p>
              <div className="field">
                <label>E-MAIL</label>
                <input
                  type="email" value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@empresa.com" autoFocus
                />
              </div>
              {error && <p className="err">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? 'ENVIANDO…' : 'ENVIAR LINK →'}
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
        .hint { margin: 0; font-size: 11.5px; color: #97a097; line-height: 1.5; }
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
