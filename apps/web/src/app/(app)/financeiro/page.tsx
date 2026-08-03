'use client';

import { useState } from 'react';

interface Rule {
  id: string;
  kind: 'TAX' | 'FEE' | 'OPCOST';
  name: string;
  calcType: 'PERCENT' | 'FIXED';
  value: number;
}

const KIND_LABEL: Record<Rule['kind'], string> = { TAX: 'Imposto', FEE: 'Taxa', OPCOST: 'Custo Op.' };

export default function FinanceiroPage() {
  const [rules, setRules] = useState<Rule[]>([
    { id: '1', kind: 'TAX', name: 'Simples Nacional', calcType: 'PERCENT', value: 0.06 },
    { id: '2', kind: 'OPCOST', name: 'Ferramentas/SaaS', calcType: 'FIXED', value: 800 },
  ]);
  const [form, setForm] = useState<Omit<Rule, 'id'>>({ kind: 'TAX', name: '', calcType: 'PERCENT', value: 0 });

  // Preview do cálculo (BLUEPRINT seção 7.2) — valores de exemplo.
  const receitaBruta = 218400;
  const investido = 54200;
  const taxasGateway = 6100;
  const valorImposto = rules.filter((r) => r.kind === 'TAX').reduce((a, r) => a + (r.calcType === 'PERCENT' ? receitaBruta * r.value : r.value), 0);
  const custosOp = rules.filter((r) => r.kind === 'OPCOST').reduce((a, r) => a + (r.calcType === 'PERCENT' ? receitaBruta * r.value : r.value), 0);
  const custoTotal = investido + taxasGateway + valorImposto + custosOp;
  const lucroLiquido = receitaBruta - custoTotal;
  const margem = lucroLiquido / receitaBruta;

  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setRules((prev) => [...prev, { ...form, id: Date.now().toString(), value: form.calcType === 'PERCENT' ? form.value / 100 : form.value }]);
    setForm({ kind: 'TAX', name: '', calcType: 'PERCENT', value: 0 });
  }

  function remove(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="grid">
      <div>
        <p className="lead">
          Configure impostos, taxas e custos operacionais. Eles entram automaticamente
          no cálculo de lucro líquido e margem, refletindo no dashboard.
        </p>

        <section className="block">
          <h3>REGRAS ATIVAS</h3>
          <table>
            <thead><tr><th>NOME</th><th>TIPO</th><th>VALOR</th><th></th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="strong">{r.name}</td>
                  <td><span className={`badge ${r.kind.toLowerCase()}`}>{KIND_LABEL[r.kind]}</span></td>
                  <td className="mono">{r.calcType === 'PERCENT' ? `${(r.value * 100).toFixed(1)}%` : brl(r.value)}</td>
                  <td className="right"><button className="x" onClick={() => remove(r.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="block">
          <h3>NOVA REGRA</h3>
          <form onSubmit={addRule} className="rule-form">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Rule['kind'] })}>
              <option value="TAX">Imposto</option>
              <option value="FEE">Taxa</option>
              <option value="OPCOST">Custo Operacional</option>
            </select>
            <input placeholder="nome da regra" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.calcType} onChange={(e) => setForm({ ...form, calcType: e.target.value as Rule['calcType'] })}>
              <option value="PERCENT">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
            </select>
            <input type="number" step="0.01" placeholder="valor" value={form.value || ''} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            <button className="primary" type="submit">+ Adicionar</button>
          </form>
        </section>
      </div>

      <aside className="preview">
        <h3>PREVIEW · 30D</h3>
        <div className="calc">
          <div className="line"><span>Receita Bruta</span><b>{brl(receitaBruta)}</b></div>
          <div className="line neg"><span>− Investimento</span><b>{brl(investido)}</b></div>
          <div className="line neg"><span>− Taxas gateway</span><b>{brl(taxasGateway)}</b></div>
          <div className="line neg"><span>− Impostos</span><b>{brl(valorImposto)}</b></div>
          <div className="line neg"><span>− Custos op.</span><b>{brl(custosOp)}</b></div>
          <div className="rule" />
          <div className="line total"><span>Lucro Líquido</span><b>{brl(lucroLiquido)}</b></div>
          <div className="line margin"><span>Margem</span><b>{(margem * 100).toFixed(1)}%</b></div>
        </div>
      </aside>

      <style jsx>{`
        .grid { display: grid; grid-template-columns: 1fr 300px; gap: 26px; }
        @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
        .lead { color: #8a938a; font-size: 12.5px; line-height: 1.6; max-width: 66ch; margin: 0 0 26px; }
        .block { margin-bottom: 28px; }
        h3 { font-size: 10.5px; letter-spacing: 0.2em; color: #6d766c; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; letter-spacing: 0.12em; color: #5f685f; padding: 8px 12px; border-bottom: 1px solid #1c211d; font-weight: 400; }
        td { padding: 11px 12px; border-bottom: 1px solid #141715; font-size: 13px; }
        .strong { color: #eef3e8; }
        .mono { font-variant-numeric: tabular-nums; color: #d7dcd4; }
        .right { text-align: right; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 2px; }
        .badge.tax { color: #e0a83d; background: #2a2410; }
        .badge.fee { color: #6db3ff; background: #0e1f30; }
        .badge.opcost { color: #c78bff; background: #1e1430; }
        .x { background: none; border: none; color: #5f685f; cursor: pointer; font-size: 13px; }
        .x:hover { color: #ff6a5a; }
        .rule-form { display: flex; flex-wrap: wrap; gap: 8px; }
        select, .rule-form input { background: #070807; border: 1px solid #232823; color: #eef3e8; padding: 9px 11px; border-radius: 2px; font-family: inherit; font-size: 12.5px; outline: none; }
        select:focus, .rule-form input:focus { border-color: #b6ff3d; }
        .rule-form input[type='number'] { width: 100px; }
        .primary { background: #b6ff3d; color: #0b0d0c; border: none; padding: 9px 15px; border-radius: 2px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
        .preview { background: #0e100f; border: 1px solid #1c211d; border-radius: 5px; padding: 18px 20px; align-self: start; }
        .calc { display: flex; flex-direction: column; gap: 11px; margin-top: 8px; }
        .line { display: flex; justify-content: space-between; font-size: 13px; }
        .line span { color: #8a938a; }
        .line b { color: #d7dcd4; font-variant-numeric: tabular-nums; font-weight: 500; }
        .line.neg b { color: #a98f6a; }
        .rule { height: 1px; background: #1c211d; margin: 4px 0; }
        .line.total b { color: #b6ff3d; font-size: 16px; }
        .line.total span { color: #d7dcd4; }
        .line.margin b { color: #b6ff3d; }
      `}</style>
    </div>
  );
}
