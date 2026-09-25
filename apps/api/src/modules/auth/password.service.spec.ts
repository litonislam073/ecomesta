import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and verifies', async () => {
    const hashed = await service.hash('SecurePass1');
    expect(hashed.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hashed, 'SecurePass1')).resolves.toBe(true);
    await expect(service.verify(hashed, 'WrongPass1')).resolves.toBe(false);
  });

  it('hashes tokens deterministically with sha256', () => {
    const a = service.hashToken('token-value');
    const b = service.hashToken('token-value');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});
