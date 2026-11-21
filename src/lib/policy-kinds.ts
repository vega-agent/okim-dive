export const POLICY_KINDS = ['refund', 'privacy', 'terms'] as const
export type PolicyKind = typeof POLICY_KINDS[number]