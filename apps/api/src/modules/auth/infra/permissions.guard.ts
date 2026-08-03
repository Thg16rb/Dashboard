import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { Permission } from '../domain/permissions';
import { JwtAccessPayload } from '../domain/auth.types';

/**
 * Verifica as permissões do JWT (BLUEPRINT seção 3.2).
 * Deve ser usado após o JwtAuthGuard (que popula request.user).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest().user as JwtAccessPayload;
    const granted = new Set(user?.perms ?? []);
    const ok = required.every((p) => granted.has(p));
    if (!ok) {
      throw new ForbiddenException('Permissão insuficiente');
    }
    return true;
  }
}
