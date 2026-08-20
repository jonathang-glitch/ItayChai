import { ForbiddenException } from '@nestjs/common';
import { hasPermission } from '@itay-chai/auth';

export function assertPermission(permission: string) {
  if (!hasPermission(permission)) {
    throw new ForbiddenException(`Missing permission ${permission}`);
  }
}
