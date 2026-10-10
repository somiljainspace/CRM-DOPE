// Segments builder: definition construction + validation tests (pure functions).
// Component-level rendering is NOT tested here (no DOM test runner configured);
// these verify the real definition schema contract the editor generates.
import {
  SegmentDefinitionSchema,
  SEGMENT_LIMITS,
} from '../../services/segments/definition';

const baseCondition = {
  kind: 'profile_trait' as const,
  field: 'plan' as const,
  operator: 'equals' as const,
  value: 'pro',
};

describe('Segment definition schema (editor contract)', () => {
  it('accepts a minimal valid definition', () => {
    const def = { definition_version: 1, operator: 'AND', conditions: [baseCondition] };
    const parsed = SegmentDefinitionSchema.parse(def);
    expect(parsed.definition_version).toBe(1);
    expect(parsed.operator).toBe('AND');
    expect(parsed.conditions).toHaveLength(1);
  });

  it('accepts all four real condition kinds', () => {
    const def = {
      definition_version: 1,
      operator: 'OR',
      conditions: [
        { kind: 'profile_trait', field: 'plan', operator: 'equals', value: 'pro' },
        { kind: 'event_occurrence', event_name: 'purchase', performed: true, window_days: 30 },
        { kind: 'event_count', event_name: 'purchase', count_operator: 'at_least', count: 3, window_days: 90 },
        { kind: 'recency', type: 'active_within', days: 7 },
      ],
    };
    const parsed = SegmentDefinitionSchema.parse(def);
    expect(parsed.conditions.map((c: any) => c.kind)).toEqual([
      'profile_trait',
      'event_occurrence',
      'event_count',
      'recency',
    ]);
  });

  it('supports event_occurrence with optional property_filter', () => {
    const def = {
      definition_version: 1,
      operator: 'AND',
      conditions: [
        {
          kind: 'event_occurrence',
          event_name: 'purchase',
          performed: false,
          window_days: 14,
          property_filter: { field: 'plan', operator: 'equals', value: 'pro' },
        },
      ],
    };
    const parsed = SegmentDefinitionSchema.parse(def);
    expect(parsed.conditions[0]).toHaveProperty('property_filter');
  });

  it('rejects an invalid condition kind (backend is authoritative)', () => {
    const def = {
      definition_version: 1,
      operator: 'AND',
      conditions: [{ kind: 'property_trait', field: 'plan', operator: 'equals', value: 'pro' }],
    };
    expect(() => SegmentDefinitionSchema.parse(def)).toThrow();
  });

  it('rejects unknown trait fields', () => {
    const def = {
      definition_version: 1,
      operator: 'AND',
      conditions: [{ kind: 'profile_trait', field: 'unknown_field', operator: 'equals', value: 'x' }],
    };
    expect(() => SegmentDefinitionSchema.parse(def)).toThrow();
  });

  it('rejects windows above 90 days', () => {
    const def = {
      definition_version: 1,
      operator: 'AND',
      conditions: [
        { kind: 'event_count', event_name: 'purchase', count_operator: 'at_least', count: 1, window_days: 91 },
      ],
    };
    expect(() => SegmentDefinitionSchema.parse(def)).toThrow();
  });

  it('rejects more than 20 conditions', () => {
    const conditions = Array.from({ length: 21 }, () => ({ ...baseCondition }));
    const def = { definition_version: 1, operator: 'AND', conditions };
    expect(() => SegmentDefinitionSchema.parse(def)).toThrow();
  });

  it('rejects zero conditions', () => {
    const def = { definition_version: 1, operator: 'AND', conditions: [] };
    expect(() => SegmentDefinitionSchema.parse(def)).toThrow();
  });

  it('rejects definition_version other than 1', () => {
    const def = { definition_version: 2, operator: 'AND', conditions: [baseCondition] };
    expect(() => SegmentDefinitionSchema.parse(def)).toThrow();
  });

  it('serializes a definition to JSON and back without loss', () => {
    const def = {
      definition_version: 1,
      operator: 'OR',
      conditions: [
        { kind: 'recency', type: 'inactive_for', days: 30 },
        { kind: 'event_count', event_name: 'purchase', count_operator: 'exactly', count: 5, window_days: 60 },
      ],
    };
    const round = JSON.parse(JSON.stringify(def));
    const parsed = SegmentDefinitionSchema.parse(round);
    expect(parsed).toEqual(def);
  });

  it('documents the enforced limits', () => {
    expect(SEGMENT_LIMITS.maxConditions).toBe(20);
    expect(SEGMENT_LIMITS.maxWindowDays).toBe(90);
    expect(SEGMENT_LIMITS.maxNameLength).toBe(255);
    expect(SEGMENT_LIMITS.maxEventNameLength).toBe(255);
    expect(SEGMENT_LIMITS.maxStringLength).toBe(1024);
  });
});
