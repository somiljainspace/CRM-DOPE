import { z } from 'zod';

// ---- Segment definition schema (versioned, structured, no SQL fragments) ----

export const OPERATORS = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'] as const;
export type Operator = (typeof OPERATORS)[number];

export const TRAIT_FIELDS = [
  'country',
  'plan',
  'purchase_count',
  'email_domain',
  'lifecycle_stage',
] as const;
export type TraitField = (typeof TRAIT_FIELDS)[number];

export const COUNT_OPERATORS = ['at_least', 'at_most', 'exactly'] as const;
export type CountOperator = (typeof COUNT_OPERATORS)[number];

const operatorSchema = z.enum(OPERATORS);
const countOperatorSchema = z.enum(COUNT_OPERATORS);
const traitFieldSchema = z.enum(TRAIT_FIELDS);

const profileTraitSchema = z.object({
  kind: z.literal('profile_trait'),
  field: traitFieldSchema,
  operator: operatorSchema,
  value: z.union([z.string().max(1024), z.number(), z.boolean()]),
});

const eventOccurrenceSchema = z.object({
  kind: z.literal('event_occurrence'),
  event_name: z.string().min(1).max(255),
  performed: z.boolean(),
  window_days: z.number().int().min(1).max(90),
  property_filter: z
    .object({
      field: z.string().min(1).max(255),
      operator: operatorSchema,
      value: z.union([z.string().max(1024), z.number(), z.boolean()]),
    })
    .optional(),
});

const eventCountSchema = z.object({
  kind: z.literal('event_count'),
  event_name: z.string().min(1).max(255),
  count_operator: countOperatorSchema,
  count: z.number().int().min(0),
  window_days: z.number().int().min(1).max(90),
});

const recencySchema = z.object({
  kind: z.literal('recency'),
  type: z.enum(['active_within', 'inactive_for']),
  days: z.number().int().min(1).max(90),
});

export const ConditionSchema = z.discriminatedUnion('kind', [
  profileTraitSchema,
  eventOccurrenceSchema,
  eventCountSchema,
  recencySchema,
]);

export const SegmentDefinitionSchema = z.object({
  definition_version: z.literal(1),
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(ConditionSchema).min(1).max(20),
});

export type SegmentDefinition = z.infer<typeof SegmentDefinitionSchema>;

export const SEGMENT_LIMITS = {
  maxConditions: 20,
  maxWindowDays: 90,
  maxNameLength: 255,
  maxEventNameLength: 255,
  maxPropertyLength: 255,
  maxStringLength: 1024,
} as const;
