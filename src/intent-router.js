// Deterministic scope control for Realtime tool calls. This is intentionally
// separate from Policy Engine: it decides relevance and presentation, while the
// backend Policy Engine remains the authority for every write action.

const ROUTES = {
  resolution: { allowed: ['startResolutionAutopilot'], visible: ['startResolutionAutopilot'] },
  freeze_card: { allowed: ['getCardStatus', 'freezeCard'], visible: ['freezeCard'] },
  unfreeze_card: { allowed: ['getCardStatus', 'unfreezeCard'], visible: ['unfreezeCard'] },
  enable_online: { allowed: ['getCardStatus', 'enableOnlinePayments'], visible: ['enableOnlinePayments'] },
  disable_online: { allowed: ['getCardStatus', 'disableOnlinePayments'], visible: ['disableOnlinePayments'] },
  enable_international: { allowed: ['getCardStatus', 'enableInternationalPayments'], visible: ['enableInternationalPayments'] },
  card_status: { allowed: ['getCardStatus'], visible: ['getCardStatus'] },
  transactions: { allowed: ['getRecentTransactions'], visible: ['getRecentTransactions'] },
  decline_explanation: { allowed: ['getRecentTransactions', 'explainDeclineReason'], visible: ['explainDeclineReason'] },
  kyc: { allowed: ['getKycStatus'], visible: ['getKycStatus'] },
  funding: { allowed: ['generateFundingInstruction'], visible: ['generateFundingInstruction'] },
  support: { allowed: ['createSupportTicket'], visible: ['createSupportTicket'] },
};

const matches = (value, pattern) => pattern.test(value);

export function detectIntent(request = '') {
  const text = String(request || '').toLowerCase().trim();
  if (!text) return 'unknown';
  if (matches(text, /(?:fix|resolve|make .*work|autopilot|giải quyết|khắc phục|sửa .*lỗi)/)) return 'resolution';
  if (matches(text, /(?:unfreeze|unlock|mở khóa)/)) return 'unfreeze_card';
  if (matches(text, /(?:freeze|lock .*card|khóa thẻ|đóng thẻ)/)) return 'freeze_card';
  if (matches(text, /(?:disable|turn off|tắt).*(?:online|payment|thanh toán online)/)) return 'disable_online';
  if (matches(text, /(?:enable|turn on|bật).*(?:online|payment|thanh toán online)/)) return 'enable_online';
  if (matches(text, /(?:enable|turn on|bật).*(?:international|quốc tế)/)) return 'enable_international';
  if (matches(text, /(?:why.*(?:declin|fail)|explain.*(?:payment|transaction)|tại sao.*(?:từ chối|thất bại)|giải thích.*giao dịch)/)) return 'decline_explanation';
  if (matches(text, /(?:recent transaction|transactions|lịch sử giao dịch|giao dịch gần đây)/)) return 'transactions';
  if (matches(text, /(?:kyc|xác minh danh tính)/)) return 'kyc';
  if (matches(text, /(?:fund|nạp tiền|funding)/)) return 'funding';
  if (matches(text, /(?:support ticket|support|vé hỗ trợ|hỗ trợ)/)) return 'support';
  if (matches(text, /(?:card status|card controls|trạng thái thẻ|kiểm tra thẻ)/)) return 'card_status';
  return 'unknown';
}

export function routeToolCall({ request, toolName }) {
  if (toolName === 'getConversationGuidance') return { intent: detectIntent(request), allowed: true, visible: false, reason: null };
  const intent = detectIntent(request);
  const route = ROUTES[intent];
  if (!route) return { intent, allowed: true, visible: true, reason: null };
  const allowed = route.allowed.includes(toolName);
  return {
    intent,
    allowed,
    visible: route.visible.includes(toolName),
    reason: allowed ? null : `This request is focused on ${intent.replaceAll('_', ' ')}. ${toolName} is outside the relevant tool budget.`,
  };
}

export function ambiguityMessage(request = '') {
  const text = String(request || '').toLowerCase();
  if (/turn it off|tắt nó|turn off/.test(text) && !/online|payment|card|thẻ/.test(text)) {
    return 'Ask whether the customer means freezing the whole card or disabling online payments. Do not propose either action until they clarify.';
  }
  return null;
}
