import * as repo from '../../repositories/activation';

export async function checkConsent(tenantId: string, profileId: string, purpose: string): Promise<{ eligible: boolean; reason?: string }> {
  try {
    const c = await repo.getConsent(tenantId, profileId, purpose);
    if (!c) return { eligible: false, reason: 'No consent record (default deny)' };
    if (c.status === 'withdrawn') return { eligible: false, reason: 'Consent withdrawn' };
    if (c.status === 'granted') return { eligible: true };
    return { eligible: false, reason: 'Invalid consent status' };
  } catch {
    return { eligible: false, reason: 'Consent lookup failed (fail closed)' };
  }
}

export async function upsertConsent(input: Parameters<typeof repo.upsertConsent>[0]) {
  return repo.upsertConsent(input);
}
