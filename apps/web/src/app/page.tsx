export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1>Dashboard <span style={{ opacity: 0.5 }}>(TrafficIntel)</span></h1>
      <p>
        SaaS multi-tenant de inteligência para tráfego pago e gestão financeira.
        Scaffolding do MVP — Passo 1 concluído.
      </p>
      <ul>
        <li>API: NestJS + Fastify (<code>apps/api</code>)</li>
        <li>Web: Next.js App Router (<code>apps/web</code>)</li>
        <li>Infra: PostgreSQL + Redis via <code>docker-compose</code></li>
      </ul>
    </main>
  );
}
