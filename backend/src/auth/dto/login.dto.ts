import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms.js';

/** Body of POST /auth/login. */
export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', maxLength: 255 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Password123!', minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  password: string;
}
