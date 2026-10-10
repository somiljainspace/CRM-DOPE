import { generateSecret, encryptSecret, decryptSecret, signPayload } from '../../services/activation/signing';

describe('Activation signing', () => {
  it('generates unique cryptographically secure secrets', () => {
    const a = generateSecret(); const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it('encrypts and decrypts a secret round-trip (AES-256-GCM)', () => {
    const key = Buffer.alloc(32, 7);
    const secret = generateSecret();
    const enc = encryptSecret(secret, key);
    expect(decryptSecret(enc, key)).toBe(secret);
  });

  it('rejects tampered ciphertext (authenticated encryption)', () => {
    const key = Buffer.alloc(32, 7);
    const enc = encryptSecret('secret', key);
    enc[enc.length - 1] ^= 1; // flip a bit
    expect(() => decryptSecret(enc, key)).toThrow();
  });

  it('signs payload deterministically', () => {
    const sig1 = signPayload('{"a":1}', 'sk', 'del-1', 1700000000);
    const sig2 = signPayload('{"a":1}', 'sk', 'del-1', 1700000000);
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64);
  });

  it('changes signature with different timestamp or delivery id', () => {
    const s1 = signPayload('b', 'sk', 'del-1', 1);
    const s2 = signPayload('b', 'sk', 'del-1', 2);
    const s3 = signPayload('b', 'sk', 'del-2', 1);
    expect(s1).not.toBe(s2);
    expect(s1).not.toBe(s3);
  });
});
