import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

type Dependencies = ConstructorParameters<typeof AuthService>;

const storedUser = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'admin@example.com',
  passwordHash: '$2b$12$stored-hash',
  fullname: 'Admin User',
  createdAt: new Date('2026-10-02T08:00:00.000Z'),
};

function setup(found: typeof storedUser | null, passwordMatches: boolean) {
  const users = { findByEmail: vi.fn().mockResolvedValue(found) };
  const hasher = {
    hash: vi.fn().mockResolvedValue('$2b$12$dummy-hash'),
    verify: vi.fn().mockResolvedValue(passwordMatches),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  const config = { get: vi.fn().mockReturnValue(3600) };
  const service = new AuthService(
    users as unknown as Dependencies[0],
    hasher as unknown as Dependencies[1],
    jwt as unknown as Dependencies[2],
    config as unknown as Dependencies[3],
  );
  return { service, hasher, jwt };
}

describe('AuthService.login', () => {
  it('returns a Bearer token and the User for valid credentials', async () => {
    const { service, hasher, jwt } = setup(storedUser, true);
    const result = await service.login({
      email: 'admin@example.com',
      password: 'Password123!',
    });
    expect(hasher.verify).toHaveBeenCalledWith(
      'Password123!',
      '$2b$12$stored-hash',
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: storedUser.id,
      email: 'admin@example.com',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: storedUser.id,
        email: 'admin@example.com',
        fullname: 'Admin User',
        createdAt: '2026-10-02T08:00:00.000Z',
      },
    });
  });

  it('rejects a wrong password with the generic message', async () => {
    const { service, jwt } = setup(storedUser, false);
    const attempt = service.login({
      email: 'admin@example.com',
      password: 'wrong-password',
    });
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(attempt).rejects.toThrow('Invalid email or password');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('still compares a hash for an unknown email, so the timing does not reveal it', async () => {
    const { service, hasher } = setup(null, true);
    await expect(
      service.login({ email: 'nobody@example.com', password: 'Password123!' }),
    ).rejects.toThrow('Invalid email or password');
    expect(hasher.verify).toHaveBeenCalledWith(
      'Password123!',
      '$2b$12$dummy-hash',
    );
  });
});
