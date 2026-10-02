import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordHasher } from './password-hasher.js';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

/** Users and password hashing, for the auth module. */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, PasswordHasher],
  exports: [UsersService, PasswordHasher],
})
export class UsersModule {}
