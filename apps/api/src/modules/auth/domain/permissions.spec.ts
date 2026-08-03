import { permissionsForRole } from './permissions';

describe('RBAC — permissionsForRole (BLUEPRINT seção 3.2)', () => {
  it('ADMIN_GERAL tem acesso ao Painel Master', () => {
    expect(permissionsForRole('ADMIN_GERAL')).toContain('master:read');
  });

  it('ADMIN_EMPRESA NÃO tem Painel Master', () => {
    expect(permissionsForRole('ADMIN_EMPRESA')).not.toContain('master:read');
  });

  it('VISUALIZADOR só lê dashboard', () => {
    expect(permissionsForRole('VISUALIZADOR')).toEqual(['dashboard:read']);
  });

  it('OPERADOR não vê financeiro', () => {
    const perms = permissionsForRole('OPERADOR');
    expect(perms).not.toContain('finance:read');
    expect(perms).toContain('sync:run');
  });

  it('GESTOR não escreve financeiro', () => {
    expect(permissionsForRole('GESTOR')).not.toContain('finance:write');
  });

  it('papel desconhecido não recebe permissão', () => {
    expect(permissionsForRole('HACKER')).toEqual([]);
  });
});
