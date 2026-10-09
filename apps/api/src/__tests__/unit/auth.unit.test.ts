import { hashToken, generateToken } from '../../repositories/auth/sessions';
import { hashPassword, verifyPassword } from '../../repositories/auth/passwords';
import { can } from '../../services/authorization';

describe('session-token hashing', () => {
  it('hashToken is deterministic and never raw', () => {
    const raw = 'token-value';
    const h = hashToken(raw);
    expect(h).toBe(hashToken(raw));
    expect(h).not.toBe(raw);
    expect(h.length).toBe(64);
  });
});

describe('token generation', () => {
  it('generateToken yields 64 hex chars', () => {
    const t = generateToken();
    expect(t.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(t)).toBe(true);
  });
  it('two tokens differ', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('password hashing', () => {
  it('hash and verify work', async () => {
    const p = await hashPassword('secret123');
    expect(await verifyPassword('secret123', p)).toBe(true);
    expect(await verifyPassword('wrong', p)).toBe(false);
  });
});

describe('permission matrix', () => {
  const cases = [
    ['OWNER','workspace:write',true],
    ['ADMIN','workspace:write',true],
    ['VIEWER','workspace:write',false],
    ['OWNER','invitation:write',true],
    ['ADMIN','invitation:write',true],
    ['ANALYST','invitation:write',false],
    ['OWNER','role:change',true],
    ['ADMIN','role:change',false],
  ] as const;
  it.each(cases)('%s -> %s = %s', (role, perm, expected) => {
    expect(can(role as any, perm as any)).toBe(expected);
  });
});

describe('invalid auth context', () => {
  it('cannot call can with unknown role', () => {
    expect(can('NOTAROLE' as any, 'workspace:read')).toBe(false);
  });
});
