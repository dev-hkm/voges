// Deterministic conversation guidance. The model speaks naturally, but this
// server module decides whether it should clarify or safely investigate first.

const uncertain = /\b(uh+|um+|hmm+|not sure|i don'?t know|maybe|i think|forgot|something('?s| is) wrong)\b|\b(không biết|không rõ|ừm+|à+|chắc|hình như|quên|có gì đó sai)\b/i;

function includes(text, pattern) { return pattern.test(text); }
function priorText(context) { return (context || []).map((turn) => turn?.content || '').join(' ').toLowerCase(); }

export function buildConversationGuidance({ userRequest = '', priorContext = [], customerContext = null }) {
  const request = String(userRequest || '').trim();
  const lower = request.toLowerCase();
  const prior = priorText(priorContext);
  const accountStatus = customerContext?.customer?.account_status || 'unknown';
  const kycStatus = customerContext?.customer?.kyc_status || 'unknown';
  const base = { customer_goal: 'Understand the customer need', current_progress: 'Gathering context', missing_information: [], next_best_question: null, suggested_tools: [], completion_status: 'in_progress' };

  if (includes(lower, /card.*(?:doesn'?t work|not work)|thẻ.*(?:không.*(?:hoạt động|dùng được)|bị lỗi)/i)) {
    return { ...base, customer_goal: 'Restore the customer card experience', missing_information: ['payment channel'], next_best_question: 'I can help with that. Where did the card fail: an online purchase, ATM, in-store payment, or transfer?', suggested_tools: [], completion_status: 'needs_clarification' };
  }
  if (includes(lower, /(?:can'?t|cannot|unable to).*(?:receive|get).*(?:money|transfer)|(?:không.*(?:nhận được|nhận).*(?:tiền|chuyển khoản))/i)) {
    return { ...base, customer_goal: 'Restore incoming-money capability', current_progress: `Checking account status (${accountStatus}) and identity status (${kycStatus})`, suggested_tools: ['getCustomerProfile', 'getKycStatus', 'getRecentTransactions'], completion_status: 'investigating', next_best_question: null };
  }
  if (includes(lower, /(?:increase|raise|change).*(?:limit)|(?:tăng|đổi).*(?:hạn mức|limit)/i)) {
    return { ...base, customer_goal: 'Change a customer limit safely', missing_information: ['limit type'], next_best_question: 'Which limit would you like to change: card spending limit or transfer limit?', completion_status: 'needs_clarification' };
  }
  if (uncertain.test(request)) {
    if (includes(prior, /card.*(?:doesn'?t work|not work)|thẻ.*(?:không.*(?:hoạt động|dùng được)|bị lỗi)/i)) {
      return { ...base, customer_goal: 'Diagnose the card problem', current_progress: 'Customer is unsure of the payment channel', suggested_tools: ['getRecentTransactions', 'getCardStatus'], completion_status: 'investigating', next_best_question: null };
    }
    return { ...base, customer_goal: 'Clarify the customer problem with minimal effort', missing_information: ['problem area'], next_best_question: 'No problem. Is the issue with your card, a payment, receiving money, or account verification?', completion_status: 'needs_clarification' };
  }
  if (includes(lower, /(?:something.*wrong|có gì.*không ổn)/i)) {
    return { ...base, customer_goal: 'Identify the affected banking area', missing_information: ['affected area'], next_best_question: 'I can look into it. Is the issue with a card, a payment, receiving money, or identity verification?', completion_status: 'needs_clarification' };
  }
  return { ...base, customer_goal: 'Respond to the identified banking request', completion_status: 'ready_for_agent' };
}
