import { z } from 'zod';

export const SUMMARY_CARD_TYPES = [
  'transaction_summary',
  'card_status',
  'kyc_status',
  'account_balance',
  'decline_reason',
  'pending_action',
  'support_ticket',
  'security_result',
  'verified_action_receipt',
  'resolution_plan',
  'resolution_complete',
  'scam_risk',
  'session_summary',
  'generic_info',
];

const summaryActionSchema = z.object({
  label: z.string().min(1),
  action: z.string().min(1),
  variant: z.enum(['primary', 'secondary', 'ghost']).default('ghost'),
  payload: z.record(z.any()).optional(),
});

const summaryMetadataSchema = z.record(z.any()).default({});

const transactionSchema = z.object({
  id: z.string(),
  merchant: z.string().min(1),
  amount: z.number(),
  currency: z.string().min(1),
  status: z.enum(['success', 'pending', 'declined', 'refunded', 'completed']).catch('success'),
  created_at: z.string().min(1),
  category: z.string().nullable().optional(),
  direction: z.enum(['in', 'out']).optional(),
});

const cardStatusItemSchema = z.object({
  id: z.string(),
  last_four: z.string().min(4).max(4),
  kind: z.enum(['virtual', 'physical', 'unknown']).default('unknown'),
  status: z.string().min(1),
  online_payments: z.boolean(),
  international_payments: z.boolean(),
  contactless: z.boolean(),
  daily_limit: z.number().nullable().optional(),
  daily_spend: z.number().nullable().optional(),
  currency: z.string().default('VND'),
});

const summaryCardBase = z.object({
  title: z.string().min(1),
  subtitle: z.string().default(''),
  actions: z.array(summaryActionSchema).default([]),
  metadata: summaryMetadataSchema,
});

const transactionSummarySchema = summaryCardBase.extend({
  type: z.literal('transaction_summary'),
  data: z.object({
    transactions: z.array(transactionSchema),
    summary: z.object({
      count: z.number().int().nonnegative(),
      total_spent: z.number().default(0),
      total_received: z.number().default(0),
      largest_transaction: z.object({
        merchant: z.string().default('N/A'),
        amount: z.number().default(0),
      }).nullable().default(null),
    }),
  }),
});

const cardStatusSchema = summaryCardBase.extend({
  type: z.literal('card_status'),
  data: z.object({
    cards: z.array(cardStatusItemSchema),
  }),
});

const kycStatusSchema = summaryCardBase.extend({
  type: z.literal('kyc_status'),
  data: z.object({
    status: z.string().min(1),
    tier: z.string().default('Standard'),
    missing_documents: z.array(z.string()).default([]),
    last_updated: z.string().default('Unknown'),
    next_step: z.string().default('No further action required.'),
  }),
});

const accountBalanceSchema = summaryCardBase.extend({
  type: z.literal('account_balance'),
  data: z.object({
    accounts: z.array(z.object({
      id: z.string(),
      account_type: z.string().min(1),
      available_balance: z.number(),
      current_balance: z.number(),
      currency: z.string().min(1),
      status: z.string().min(1),
    })),
  }),
});

const declineReasonSchema = summaryCardBase.extend({
  type: z.literal('decline_reason'),
  data: z.object({
    merchant: z.string().min(1),
    amount: z.number(),
    currency: z.string().min(1),
    reason: z.string().min(1),
    card_ending: z.string().min(4).max(4),
    recommended_action: z.string().min(1),
    risk_level: z.string().default('medium'),
    created_at: z.string().optional(),
  }),
});

const pendingActionSchema = summaryCardBase.extend({
  type: z.literal('pending_action'),
  data: z.object({
    action_title: z.string().min(1),
    current_state: z.string().min(1),
    new_state: z.string().min(1),
    affected_resource: z.string().min(1),
    risk: z.string().min(1),
    confirmation_requirement: z.string().min(1),
    biometric_required: z.boolean(),
    expires_at: z.string().min(1),
  }),
});

const supportTicketSchema = summaryCardBase.extend({
  type: z.literal('support_ticket'),
  data: z.object({
    ticket_id: z.string().min(1),
    subject: z.string().min(1),
    status: z.string().min(1),
    priority: z.string().min(1),
    created_at: z.string().min(1),
    note: z.string().default(''),
  }),
});

const securityResultSchema = summaryCardBase.extend({
  type: z.literal('security_result'),
  data: z.object({
    verification_result: z.string().min(1),
    device_authentication_status: z.string().min(1),
    action_result: z.string().min(1),
    timestamp: z.string().min(1),
    audit_reference: z.string().min(1),
  }),
});

const verifiedActionReceiptSchema = summaryCardBase.extend({
  type: z.literal('verified_action_receipt'),
  data: z.object({
    receipt_id: z.string().min(1),
    action_id: z.string().min(1),
    issued_at: z.string().min(1),
    status: z.literal('completed'),
    tool_name: z.string().min(1),
    affected_resource: z.string().min(1),
    risk_level: z.string().min(1),
    policy_decision: z.string().min(1),
    policy_reason: z.string().min(1),
    verification_method: z.string().min(1),
    verification_status: z.string().min(1),
    database_status: z.string().min(1),
    outcome: z.string().min(1),
    state_changes: z.array(z.object({
      field: z.string().min(1),
      label: z.string().min(1),
      before: z.union([z.string(), z.number()]),
      after: z.union([z.string(), z.number()]),
    })).default([]),
    audit_event_count: z.number().int().nonnegative(),
    integrity_hash: z.string().min(16),
  }),
});

const resolutionStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  risk_level: z.string().min(1),
  estimated_effect: z.string().min(1),
  status: z.string().optional(),
});

const resolutionPlanSchema = summaryCardBase.extend({
  type: z.literal('resolution_plan'),
  data: z.object({
    plan_id: z.string().min(1),
    problem: z.string().min(1),
    root_causes: z.array(z.object({ code: z.string(), label: z.string(), status: z.string(), detail: z.string() })),
    steps: z.array(resolutionStepSchema),
    expected_result: z.string().min(1),
    readiness_status: z.string().min(1),
    blockers: z.array(z.string()).default([]),
    requires_biometric: z.boolean(),
    estimated_risk: z.string().min(1),
  }),
});

const resolutionCompleteSchema = summaryCardBase.extend({
  type: z.literal('resolution_complete'),
  data: z.object({
    problem: z.string().min(1),
    completed_steps: z.array(z.string()).default([]),
    readiness_status: z.string().min(1),
    blockers: z.array(z.string()).default([]),
    verification: z.string().min(1),
  }),
});

const scamRiskSchema = summaryCardBase.extend({
  type: z.literal('scam_risk'),
  data: z.object({
    risk_level: z.enum(['low', 'medium', 'high']),
    matched_patterns: z.array(z.object({ id: z.string(), name: z.string(), red_flags: z.array(z.string()).default([]) })),
    recommendation: z.string().min(1),
    verification_questions: z.array(z.string()).default([]),
  }),
});

const sessionSummarySchema = summaryCardBase.extend({
  type: z.literal('session_summary'),
  data: z.object({
    title: z.string().min(1),
    duration_seconds: z.number().int().nonnegative(),
    primary_intent: z.string().default('general_banking'),
    final_outcome: z.string().default('Session completed'),
    tools_called: z.array(z.string()).default([]),
    actions_completed: z.number().int().nonnegative().default(0),
    biometric_verified: z.boolean().default(false),
  }),
});

const genericInfoSchema = summaryCardBase.extend({
  type: z.literal('generic_info'),
  data: z.object({
    items: z.array(z.object({
      label: z.string().min(1),
      value: z.string().min(1),
      tone: z.enum(['neutral', 'positive', 'warning']).default('neutral'),
    })).default([]),
  }),
});

export const summaryCardSchema = z.discriminatedUnion('type', [
  transactionSummarySchema,
  cardStatusSchema,
  kycStatusSchema,
  accountBalanceSchema,
  declineReasonSchema,
  pendingActionSchema,
  supportTicketSchema,
  securityResultSchema,
  verifiedActionReceiptSchema,
  resolutionPlanSchema,
  resolutionCompleteSchema,
  scamRiskSchema,
  sessionSummarySchema,
  genericInfoSchema,
]);

export const summaryResponseSchema = z.object({
  spoken_response: z.string().default(''),
  ui: summaryCardSchema,
});

export const historySummarySchema = z.object({
  session_id: z.string().min(1),
  customer_id: z.string().min(1),
  title: z.string().min(1),
  started_at: z.string().min(1),
  ended_at: z.string().nullable().default(null),
  duration_seconds: z.number().int().nonnegative().default(0),
  primary_intent: z.string().default('general_banking'),
  summary: z.string().default(''),
  tools_called: z.array(z.string()).default([]),
  visual_cards: z.array(summaryCardSchema).default([]),
  actions_proposed: z.number().int().nonnegative().default(0),
  actions_completed: z.number().int().nonnegative().default(0),
  actions_blocked: z.number().int().nonnegative().default(0),
  biometric_verified: z.boolean().default(false),
  security_result: z.string().default(''),
  final_outcome: z.string().default(''),
  archived_at: z.string().nullable().default(null),
  deleted_from_history: z.boolean().default(false),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export function fallbackSummaryCard(input = {}) {
  return {
    type: 'generic_info',
    title: input.title || 'Summary unavailable',
    subtitle: input.subtitle || 'Showing a safe fallback view',
    data: {
      items: [
        {
          label: 'Details',
          value: 'Structured summary data was unavailable for this response.',
          tone: 'warning',
        },
      ],
    },
    actions: [],
    metadata: input.metadata || {},
  };
}

export function validateSummaryCard(card) {
  const parsed = summaryCardSchema.safeParse(card);
  if (parsed.success) return parsed.data;
  return fallbackSummaryCard({
    title: card?.title,
    subtitle: card?.subtitle,
    metadata: { issues: parsed.error.issues },
  });
}

export function validateSummaryResponse(response) {
  const parsed = summaryResponseSchema.safeParse(response);
  if (parsed.success) return parsed.data;
  return {
    spoken_response: response?.spoken_response || '',
    ui: validateSummaryCard(response?.ui || {}),
  };
}

export function validateHistorySummary(summary) {
  return historySummarySchema.parse(summary);
}
