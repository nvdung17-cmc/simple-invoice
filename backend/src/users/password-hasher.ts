import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

/** bcrypt work factor (§4.1). bcryptjs is pure JavaScript, so no native build is needed. */
export const BCRYPT_COST = 12;

/** Hashes and verifies passwords. Shared by the login flow and the seeder. */
@Injectable()
export class PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
