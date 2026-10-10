// Phase 6A: safe activation audience handling
// The existing evaluator returns bounded preview (<=100) + truncation flag.
// Complete audience requires either: (a) stable pagination mechanism, or (b) safe refusal.
// Current design: safe refusal with documented limitation; bounded pagination placeholder.

export interface AudienceResult {
  count: number;
  truncated: boolean;
  sample: string[];
  safeToActivate: boolean;
  note: string;
}

export function evaluateAudienceSafe(previewResult: { matched_profiles: number; sample: string[]; truncated: boolean; note?: string }, maxAudience: number): AudienceResult {
  const truncated = previewResult.truncated || previewResult.matched_profiles > 100;
  return {
    count: previewResult.matched_profiles,
    truncated,
    sample: previewResult.sample.slice(0, 100),
    safeToActivate: !truncated && previewResult.matched_profiles <= maxAudience,
    note: truncated ? 'Audience truncated: complete enumeration not available (preview only). Activation refused until enumeration implemented.' : 'Audience within bounds.',
  };
}
