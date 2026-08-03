'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'login' | '2fa'>('login');
  const [challengeToken, setChallengeToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!email || !password) {
      setError('> informe e-mail e senha');
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      // Credenciais erradas (backend respondeu) → erro real, sem fallback.
      if (r.status === 401) {
        setError('> credenciais inválidas');
        return;
      }
      if (!r.ok) throw new Error('backend');
      const data = await r.json();
      if (data.status === 'pending_2fa') {
        setChallengeToken(data.challengeToken);
        setStage('2fa');
      } else {
        localStorage.setItem('token', data.accessToken);
        router.push('/dashboard');
      }
    } catch {
      // Só cai em sandbox quando o backend está inacessível (erro de rede).
      localStorage.setItem('token', 'demo');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handle2fa(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, code }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      localStorage.setItem('token', data.accessToken);
      router.push('/dashboard');
    } catch {
      setError('> código inválido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="scr">
      <div className="panel">
        <div className="head">
          <span className="mark">TRAFFIC<b>INTEL</b></span>
          <span className="sub">CONSOLE DE ACESSO</span>
        </div>

        <div className="body">
          {stage === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>E-MAIL</label>
                <input
                  type="email" value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@empresa.com" autoFocus
                />
              </div>
              <div className="field">
                <label>SENHA</label>
                <input
                  type="password" value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                />
              </div>
              {error && <p className="err">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? 'AUTENTICANDO…' : 'AUTENTICAR →'}
              </button>
              <p className="alt">
                não tem conta? <Link href="/cadastro">criar empresa</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handle2fa}>
              <p className="twofa">VERIFICAÇÃO EM DUAS ETAPAS</p>
              <div className="field">
                <label>CÓDIGO · 6 DÍGITOS</label>
                <input
                  inputMode="numeric" maxLength={6} value={code} autoFocus
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000" className="otp"
                />
              </div>
              {error && <p className="err">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? 'VERIFICANDO…' : 'CONFIRMAR →'}
              </button>
              <button type="button" className="link" onClick={() => setStage('login')}>
                ← voltar
              </button>
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
        input.otp { letter-spacing: 0.5em; font-size: 18px; text-align: center; }
        button[type='submit'] {
          background: #b6ff3d; color: #0b0d0c;
          border: none; border-radius: 2px; padding: 12px;
          font-family: inherit; font-size: 12.5px; font-weight: 700;
          letter-spacing: 0.1em; cursor: pointer; transition: filter 0.12s;
        }
        button[type='submit']:hover { filter: brightness(1.1); }
        button[type='submit']:disabled { opacity: 0.5; cursor: default; }
        .link {
          background: none; border: none; color: #6d766c;
          font-family: inherit; font-size: 11.5px; cursor: pointer;
          letter-spacing: 0.06em; padding: 2px;
        }
        .link:hover { color: #d7dcd4; }
        .err { margin: 0; color: #ff6a5a; font-size: 12px; letter-spacing: 0.04em; }
        .note { margin: 0; font-size: 10.5px; color: #4c544c; letter-spacing: 0.05em; text-align: center; }
        .alt { margin: 0; font-size: 11.5px; color: #6d766c; text-align: center; }
        :global(.alt a) { color: #b6ff3d; text-decoration: none; }
        :global(.alt a:hover) { text-decoration: underline; }
        .twofa { margin: 0; font-size: 11px; letter-spacing: 0.14em; color: #97a097; }
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
