import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto.js';

/**
 * Response of POST /auth/login. The same token is also set as the httpOnly
 * `access_token` cookie; the SPA uses the cookie and ignores this field.
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT for the `Authorization: Bearer` header (Swagger, curl).',
  })
  accessToken: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({
    description: 'Lifetime of the token in seconds.',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
