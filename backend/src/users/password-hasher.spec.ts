import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  it('refuses a password that bcrypt would cut short', async () => {
    await expect(new PasswordHasher().hash('a'.repeat(73))).rejects.toThrow(
      'bcrypt reads only the first 72 bytes of a password',
    );
  });
});
