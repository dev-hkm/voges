export const BANKING_TOOLS = [
  { type: 'function', name: 'getCustomerProfile', description: 'Read the identified customer profile, accounts, KYC status, and account status.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'getRecentTransactions', description: 'Read the customer recent transactions. Use merchant when a merchant is mentioned, such as Netflix.', parameters: { type: 'object', properties: { merchant: { type: 'string', description: 'Optional merchant name to match.' }, limit: { type: 'integer', minimum: 1, maximum: 10 } }, additionalProperties: false } },
  { type: 'function', name: 'getCardStatus', description: 'Read card status, payment toggles, and limits for the customer.', parameters: { type: 'object', properties: { card_id: { type: 'string' } }, additionalProperties: false } },
  { type: 'function', name: 'getKycStatus', description: 'Read the customer KYC status and latest submitted document status.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'explainDeclineReason', description: 'Explain the reason for a declined transaction. Use merchant or transaction_id when known.', parameters: { type: 'object', properties: { transaction_id: { type: 'string' }, merchant: { type: 'string' } }, additionalProperties: false } },
  { type: 'function', name: 'generateFundingInstruction', description: 'Read official funding instructions from the bank product documents.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'enableOnlinePayments', description: 'Propose enabling online payments for the customer card. Never execute it directly; the customer must review and verify on screen.', parameters: { type: 'object', properties: { card_id: { type: 'string' } }, required: ['card_id'], additionalProperties: false } },
  { type: 'function', name: 'disableOnlinePayments', description: 'Propose disabling online payments for a card; requires on-screen approval.', parameters: { type: 'object', properties: { card_id: { type: 'string' } }, required: ['card_id'], additionalProperties: false } },
  { type: 'function', name: 'enableInternationalPayments', description: 'Propose enabling international payments for a card; requires device verification.', parameters: { type: 'object', properties: { card_id: { type: 'string' } }, required: ['card_id'], additionalProperties: false } },
  { type: 'function', name: 'freezeCard', description: 'Propose freezing a card; requires device verification.', parameters: { type: 'object', properties: { card_id: { type: 'string' } }, required: ['card_id'], additionalProperties: false } },
  { type: 'function', name: 'unfreezeCard', description: 'Propose unfreezing a card; requires device verification.', parameters: { type: 'object', properties: { card_id: { type: 'string' } }, required: ['card_id'], additionalProperties: false } },
  { type: 'function', name: 'createSupportTicket', description: 'Propose creating a support ticket; customer must approve on screen.', parameters: { type: 'object', properties: { subject: { type: 'string' }, description: { type: 'string' } }, required: ['subject'], additionalProperties: false } },
];

export const SUGGESTED_ACTIONS = [
  {
    label: 'Why was my card declined?',
    prompt: 'Why was my Netflix payment declined?',
    group: 'Card',
    intent: 'Decline analysis',
    proof: 'Reads transactions and card controls',
    risk: 'Low',
  },
  {
    label: 'Show recent transactions',
    prompt: 'Show me my recent transactions.',
    group: 'Transactions',
    intent: 'Account activity',
    proof: 'Opens a banking insight modal',
    risk: 'Low',
  },
  {
    label: 'Check my KYC status',
    prompt: 'Can you check my KYC status?',
    group: 'Identity',
    intent: 'KYC review',
    proof: 'Reads verified customer data',
    risk: 'Low',
  },
  {
    label: 'Enable online payments',
    prompt: 'Enable online payments for my card.',
    group: 'Security action',
    intent: 'Payment control change',
    proof: 'Requires policy, approval, passkey',
    risk: 'Medium',
  },
  {
    label: 'Create support ticket',
    prompt: 'I need help creating a support ticket.',
    group: 'Support',
    intent: 'Case creation',
    proof: 'Creates a pending action first',
    risk: 'Medium',
  },
];

export const TOOL_LABELS = {
  getCustomerProfile: 'Reading customer profile',
  getRecentTransactions: 'Reading transactions',
  getCardStatus: 'Reading card',
  getKycStatus: 'Reading KYC status',
  explainDeclineReason: 'Explaining decline',
  generateFundingInstruction: 'Reading funding instructions',
  createSupportTicket: 'Proposing support ticket', enableOnlinePayments: 'Proposing online payments', disableOnlinePayments: 'Proposing payment change', enableInternationalPayments: 'Proposing international payments', freezeCard: 'Proposing card freeze', unfreezeCard: 'Proposing card unlock',
};

export const ACTION_TOOL_NAMES = new Set(['enableOnlinePayments','disableOnlinePayments','enableInternationalPayments','disableInternationalPayments','toggleSavingsFeature','freezeCard','unfreezeCard','replaceCard','createSupportTicket','generateFundingInstructions','escalateToHuman']);
