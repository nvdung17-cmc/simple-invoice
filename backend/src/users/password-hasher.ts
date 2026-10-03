import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

/** bcrypt work factor (§4.1). bcryptjs is pure JavaScript, so no native build is needed. */
export const BCRYPT_COST = 12;

/** Hashes and verifies passwords. Shared by the login flow and the seeder. */
@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    // Safety net: the login body and the seed settings already cap a password at
    // 72 bytes.
    if (bcrypt.truncates(password)) {
      throw new Error('bcrypt reads only the first 72 bytes of a password');
    }
    return bcrypt.hash(password, BCRYPT_COST);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
