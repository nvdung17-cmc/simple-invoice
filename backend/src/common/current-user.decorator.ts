import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '../users/user.entity.js';

/** The User that the JWT guard loaded for this request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<{ user: User }>().user,
);
