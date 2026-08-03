import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage } from './tenant-context';
import { JwtAccessPayload } from '../../modules/auth/domain/auth.types';

/**
 * Popula o AsyncLocalStorage com o tenant do JWT para cada request
 * autenticado. A camada Prisma usa isso para aplicar SET app.tenant_id
 * e ativar as policies de RLS (BLUEPRINT seção 3.1).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = ctx.switchToHttp().getRequest().user as
      | JwtAccessPayload
      | undefined;

    if (!user?.tenantId) {
      return next.handle();
    }
    return tenantStorage.run(
      { tenantId: user.tenantId, userId: user.sub },
      () => next.handle(),
    );
  }
}
