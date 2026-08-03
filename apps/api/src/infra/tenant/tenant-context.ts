import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Armazena o tenant do request atual usando AsyncLocalStorage,
 * para que a camada de dados aplique o contexto de RLS sem propagar
 * o tenantId manualmente por toda a stack (BLUEPRINT seção 3.1).
 */
export interface TenantStore {
  tenantId: string;
  userId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function currentTenant(): TenantStore | undefined {
  return tenantStorage.getStore();
}
