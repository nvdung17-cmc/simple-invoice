import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../users/user.entity.js';

/** The signed-in User as the API returns it. The password hash is never included. */
export class UserDto {
  @ApiProperty({
    format: 'uuid',
    example: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  })
  id: string;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'Admin User' })
  fullname: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-02T08:00:00.000Z' })
  createdAt: string;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullname: user.fullname,
    createdAt: user.createdAt.toISOString(),
  };
}
