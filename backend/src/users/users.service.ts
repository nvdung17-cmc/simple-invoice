import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

/** Reads Users. There is no sign-up: the seeder creates the only User. */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * Finds a User by email regardless of case (this uses the unique index on
   * lower(email)), including the password hash for the login check.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }
}
