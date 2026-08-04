import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAccessPayload } from '../../modules/auth/domain/auth.types';

/**
 * Registra cada requisição HTTP na tabela api_logs para o painel de atividade
 * (BLUEPRINT seção 8.4). Não bloqueia a resposta: grava em background.
 * Ignora as próprias rotas de atividade/health/docs para não poluir/loopar.
 */
@Injectable()
export class ApiLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const path: string = req.url ?? req.raw?.url ?? '';
    const method: string = req.method ?? 'GET';
    const start = Date.now();

    const skip = /^\/(health|activity|api\/docs)/.test(path);

    return next.handle().pipe(
      tap({
        next: () => this.record(req, method, path, start, skip),
        error: () => this.record(req, method, path, start, skip, true),
      }),
    );
  }

  private record(
    req: { user?: JwtAccessPayload; ip?: string; res?: { statusCode?: number } },
    method: string,
    path: string,
    start: number,
    skip: boolean,
    errored = false,
  ): void {
    if (skip) return;
    const status = errored ? 500 : req.res?.statusCode ?? 200;
    const kind = path.startsWith('/webhooks') ? 'webhook' : 'http';
    void this.prisma.apiLog
      .create({
        data: {
          kind,
          method,
          path: path.split('?')[0].slice(0, 200),
          statusCode: status,
          durationMs: Date.now() - start,
          tenantId: req.user?.tenantId,
          ip: req.ip,
        },
      })
      .catch(() => undefined); // logging nunca derruba a request
  }
}
