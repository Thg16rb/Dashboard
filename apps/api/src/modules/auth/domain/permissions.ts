/**
 * RBAC — permissões por papel (BLUEPRINT seção 3.2).
 * Permissões no formato `resource:action`. Papéis mapeiam para conjuntos.
 */

export type Permission =
  | 'tenant:read'
  | 'tenant:write'
  | 'user:read'
  | 'user:write'
  | 'integration:read'
  | 'integration:write'
  | 'sync:run'
  | 'webhook:read'
  | 'webhook:write'
  | 'finance:read'
  | 'finance:write'
  | 'dashboard:read'
  | 'master:read'; // Painel Master (Administrador Geral)

export type Role =
  | 'ADMIN_GERAL'
  | 'ADMIN_EMPRESA'
  | 'FINANCEIRO'
  | 'GESTOR'
  | 'ANALISTA'
  | 'OPERADOR'
  | 'VISUALIZADOR';

const ALL: Permission[] = [
  'tenant:read', 'tenant:write', 'user:read', 'user:write',
  'integration:read', 'integration:write', 'sync:run',
  'webhook:read', 'webhook:write', 'finance:read', 'finance:write',
  'dashboard:read', 'master:read',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Plataforma inteira, incluindo Painel Master
  ADMIN_GERAL: ALL,
  // Tudo do tenant, sem Painel Master
  ADMIN_EMPRESA: ALL.filter((p) => p !== 'master:read'),
  // Config financeira + relatórios; leitura geral
  FINANCEIRO: [
    'tenant:read', 'dashboard:read', 'finance:read', 'finance:write',
    'integration:read', 'webhook:read',
  ],
  // Campanhas, dashboards, metas; sem financeiro sensível
  GESTOR: [
    'tenant:read', 'dashboard:read', 'integration:read', 'integration:write',
    'sync:run', 'webhook:read',
  ],
  // Leitura + análises/exportação
  ANALISTA: ['tenant:read', 'dashboard:read', 'integration:read', 'webhook:read'],
  // Opera sync/webhooks; sem dados financeiros
  OPERADOR: [
    'tenant:read', 'integration:read', 'integration:write', 'sync:run',
    'webhook:read', 'webhook:write',
  ],
  // Somente leitura do dashboard
  VISUALIZADOR: ['dashboard:read'],
};

export function permissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}
