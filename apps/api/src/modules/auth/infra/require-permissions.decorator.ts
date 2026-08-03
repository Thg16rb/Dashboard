import { SetMetadata } from '@nestjs/common';
import { Permission } from '../domain/permissions';

export const PERMISSIONS_KEY = 'required_permissions';

/** Exige que o usuário tenha TODAS as permissões listadas. */
export const RequirePermissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
