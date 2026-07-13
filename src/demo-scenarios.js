export function buildAdaptiveActionScenarios(card) {
  const onlineEnabled = card ? Boolean(card.online_payment_enabled) : false;
  const cardLocked = card?.status === 'locked';

  return [
    {
      id: 'online_control',
      title: onlineEnabled ? 'Disable online payments' : 'Enable online payments',
      risk: 'Approval',
      prompt: onlineEnabled ? 'Disable online payments for my card.' : 'Enable online payments for my card.',
      goal: 'Show a real before/after D1 change protected by policy, approval, and the required verification path.',
      path: ['Voice intent', 'Policy engine', 'Pending action', 'Approval', 'Execute', 'Receipt'],
      expected: onlineEnabled
        ? 'The approval sheet shows Online On to Off, then D1 and the verified receipt confirm the change.'
        : 'The approval sheet shows Online Off to On, then D1 and the verified receipt confirm the change.',
    },
    {
      id: 'card_security_control',
      title: cardLocked ? 'Unlock card' : 'Freeze card',
      risk: 'High risk',
      prompt: cardLocked ? 'Unlock my card.' : 'Freeze my card.',
      goal: 'Show that a high-risk card control requires a bounded approval contract and real WebAuthn verification.',
      path: ['Voice intent', 'High-risk policy', 'Pending action', 'Passkey', 'D1 commit', 'Audit receipt'],
      expected: cardLocked
        ? 'The current locked state changes to active only after device verification.'
        : 'The current active state changes to locked only after device verification.',
    },
  ];
}
