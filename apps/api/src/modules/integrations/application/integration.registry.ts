import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationConnector } from '../domain/connector';

export const CONNECTORS = Symbol('CONNECTORS');

/**
 * Registro de connectors (BLUEPRINT seção 4.1/4.3).
 * Recebe todos os connectors via DI; adicionar um provedor = registrar a classe,
 * sem tocar no pipeline. O sync conhece apenas o registry + contrato.
 */
@Injectable()
export class IntegrationRegistry {
  private readonly byCode = new Map<string, IntegrationConnector>();

  constructor(connectors: IntegrationConnector[]) {
    for (const c of connectors) {
      this.byCode.set(c.code, c);
    }
  }

  get(code: string): IntegrationConnector {
    const c = this.byCode.get(code);
    if (!c) throw new NotFoundException(`Connector não registrado: ${code}`);
    return c;
  }

  list(): IntegrationConnector[] {
    return [...this.byCode.values()];
  }
}
