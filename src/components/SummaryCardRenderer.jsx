import { Component, memo } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CreditCard,
  Landmark,
  ReceiptText,
  ShieldCheck,
  ShieldAlert,
  Ticket,
  Wallet,
} from 'lucide-react';
import { validateSummaryCard } from '../../shared/ui-contracts.js';

function formatMoney(amount, currency = 'VND') {
  const value = Number(amount);
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeCurrency = String(currency || 'VND').trim().toUpperCase();

  // Some real banking-ledger assets (for example PAXG) are not ISO-4217
  // currency codes. Intl throws for them; a display card must never take down
  // the entire voice UI because one transaction uses a non-fiat asset code.
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: safeCurrency === 'VND' ? 0 : 2,
    }).format(safeValue);
  } catch {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(safeValue)} ${safeCurrency}`;
  }
}

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

function toneClass(tone) {
  if (tone === 'positive') return 'is-positive';
  if (tone === 'warning') return 'is-warning';
  return 'is-neutral';
}

function CardShell({ icon, title, subtitle, children, actions = [], onAction }) {
  return (
    <article className="summary-card">
      <header className="summary-card-head">
        <div className="summary-card-icon">{icon}</div>
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <div className="summary-card-body">{children}</div>
      {actions.length ? (
        <footer className="summary-card-actions">
          {actions.map((action) => (
            <button
              key={`${action.action}-${action.label}`}
              className={`summary-card-action variant-${action.variant || 'ghost'}`}
              onClick={() => onAction?.(action)}
              type="button"
            >
              <span>{action.label}</span>
              <ArrowRight size={14} />
            </button>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

function TransactionSummaryCard({ card, onAction }) {
  const transactions = card.data.transactions || [];
  const summary = card.data.summary || {};
  return (
    <CardShell icon={<ReceiptText size={18} />} title={card.title} subtitle={card.subtitle} actions={card.actions} onAction={onAction}>
      <div className="summary-list">
        {transactions.map((transaction) => (
          <div className="summary-list-row" key={transaction.id}>
            <div>
              <strong>{transaction.merchant}</strong>
              <span>{formatDate(transaction.created_at)}</span>
            </div>
            <div className="summary-list-side">
              <strong className={transaction.direction === 'in' ? 'amount-in' : 'amount-out'}>
                {transaction.direction === 'in' ? '+' : '-'}
                {formatMoney(Math.abs(transaction.amount), transaction.currency)}
              </strong>
              <span>{transaction.status}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="summary-stat-grid">
        <div><span>Transactions</span><strong>{summary.count || 0}</strong></div>
        <div><span>Total spent</span><strong>{formatMoney(summary.total_spent || 0, transactions[0]?.currency || 'VND')}</strong></div>
        <div><span>Total received</span><strong>{formatMoney(summary.total_received || 0, transactions[0]?.currency || 'VND')}</strong></div>
        <div><span>Largest</span><strong>{summary.largest_transaction ? `${summary.largest_transaction.merchant} · ${formatMoney(summary.largest_transaction.amount, transactions[0]?.currency || 'VND')}` : 'N/A'}</strong></div>
      </div>
    </CardShell>
  );
}

function CardStatusCard({ card }) {
  return (
    <CardShell icon={<CreditCard size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="summary-list">
        {(card.data.cards || []).map((item) => (
          <div className="summary-list-row" key={item.id}>
            <div>
              <strong>Card ending {item.last_four}</strong>
              <span>{item.kind} · {item.status}</span>
            </div>
            <div className="summary-list-side">
              <span>Online {item.online_payments ? 'On' : 'Off'}</span>
              <span>Intl {item.international_payments ? 'On' : 'Off'}</span>
              <span>Contactless {item.contactless ? 'On' : 'Off'}</span>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function KycStatusCard({ card }) {
  return (
    <CardShell icon={<BadgeCheck size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="summary-kv">
        <div><span>Status</span><strong>{card.data.status}</strong></div>
        <div><span>Tier</span><strong>{card.data.tier}</strong></div>
        <div><span>Last updated</span><strong>{formatDate(card.data.last_updated)}</strong></div>
        <div><span>Next step</span><strong>{card.data.next_step}</strong></div>
      </div>
      {card.data.missing_documents?.length ? (
        <div className="summary-tags">
          {card.data.missing_documents.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : null}
    </CardShell>
  );
}

function AccountBalanceCard({ card }) {
  return (
    <CardShell icon={<Wallet size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="summary-list">
        {(card.data.accounts || []).map((account) => (
          <div className="summary-list-row" key={account.id}>
            <div>
              <strong>{account.account_type}</strong>
              <span>{account.status}</span>
            </div>
            <div className="summary-list-side">
              <strong>{formatMoney(account.available_balance, account.currency)}</strong>
              <span>Current {formatMoney(account.current_balance, account.currency)}</span>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function DeclineReasonCard({ card }) {
  return (
    <CardShell icon={<ReceiptText size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="summary-kv">
        <div><span>Merchant</span><strong>{card.data.merchant}</strong></div>
        <div><span>Amount</span><strong>{formatMoney(card.data.amount, card.data.currency)}</strong></div>
        <div><span>Reason</span><strong>{card.data.reason}</strong></div>
        <div><span>Recommended next step</span><strong>{card.data.recommended_action}</strong></div>
      </div>
    </CardShell>
  );
}

function PendingActionCard({ card }) {
  return (
    <CardShell icon={<ShieldCheck size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="summary-kv">
        <div><span>Current state</span><strong>{card.data.current_state}</strong></div>
        <div><span>New state</span><strong>{card.data.new_state}</strong></div>
        <div><span>Resource</span><strong>{card.data.affected_resource}</strong></div>
        <div><span>Risk</span><strong>{card.data.risk}</strong></div>
        <div><span>Confirmation</span><strong>{card.data.confirmation_requirement}</strong></div>
        <div><span>Passkey</span><strong>{card.data.biometric_required ? 'Required' : 'Not required'}</strong></div>
      </div>
    </CardShell>
  );
}

function SupportTicketCard({ card }) {
  return (
    <CardShell icon={<Ticket size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="summary-kv">
        <div><span>Subject</span><strong>{card.data.subject}</strong></div>
        <div><span>Status</span><strong>{card.data.status}</strong></div>
        <div><span>Priority</span><strong>{card.data.priority}</strong></div>
        <div><span>Created</span><strong>{formatDate(card.data.created_at)}</strong></div>
      </div>
    </CardShell>
  );
}

function SecurityResultCard({ card }) {
  return (
    <CardShell icon={<ShieldCheck size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="summary-kv">
        <div><span>Verification</span><strong>{card.data.verification_result}</strong></div>
        <div><span>Device authentication</span><strong>{card.data.device_authentication_status}</strong></div>
        <div><span>Action result</span><strong>{card.data.action_result}</strong></div>
        <div><span>Audit ref</span><strong>{card.data.audit_reference}</strong></div>
      </div>
    </CardShell>
  );
}

function VerifiedActionReceiptCard({ card, onAction }) {
  const data = card.data;
  const shortHash = `${data.integrity_hash.slice(0, 12)}…${data.integrity_hash.slice(-8)}`;
  return (
    <CardShell icon={<ReceiptText size={18} />} title={card.title} subtitle={card.subtitle} actions={card.actions} onAction={onAction}>
      <div className="receipt-status-line">
        <span><BadgeCheck size={16} /> Completed</span>
        <small>{formatDate(data.issued_at)}</small>
      </div>
      <div className="summary-kv receipt-kv">
        <div><span>Action</span><strong>{data.tool_name}</strong></div>
        <div><span>Resource</span><strong>{data.affected_resource}</strong></div>
        <div><span>Policy</span><strong>{data.policy_decision}</strong></div>
        <div><span>Risk</span><strong>{data.risk_level}</strong></div>
        <div><span>Verification</span><strong>{data.verification_status}</strong></div>
        <div><span>Persistence</span><strong>{data.database_status}</strong></div>
      </div>
      {data.state_changes.length ? (
        <div className="receipt-changes">
          <span>Verified state change</span>
          {data.state_changes.map((change) => (
            <div key={change.field}>
              <strong>{change.label}</strong>
              <small>{String(change.before)} <ArrowRight size={12} /> {String(change.after)}</small>
            </div>
          ))}
        </div>
      ) : null}
      <div className="receipt-outcome">
        <span>Outcome</span>
        <strong>{data.outcome}</strong>
      </div>
      <div className="receipt-proof">
        <div><span>Audit events</span><strong>{data.audit_event_count}</strong></div>
        <div><span>Integrity hash</span><code title={data.integrity_hash}>{shortHash}</code></div>
      </div>
    </CardShell>
  );
}

function ResolutionPlanCard({ card, onAction }) {
  const data = card.data;
  return (
    <CardShell icon={<ShieldCheck size={18} />} title={card.title} subtitle={card.subtitle} actions={card.actions} onAction={onAction}>
      <div className="resolution-problem"><span>Problem</span><strong>{data.problem}</strong></div>
      <div className="resolution-section"><span>Root cause</span>{data.root_causes.map((cause) => <div className="resolution-row" key={cause.code}><strong>{cause.label}</strong><small>{cause.detail}</small></div>)}</div>
      <div className="resolution-section"><span>Resolution plan</span>{data.steps.map((step) => <div className="resolution-row" key={step.id}><strong>{step.title}<em className={`risk-${step.risk_level}`}>{step.risk_level}</em></strong><small>{step.estimated_effect}</small></div>)}</div>
      <div className={`resolution-outcome ${data.readiness_status === 'ready_after_plan' ? 'is-ready' : 'is-blocked'}`}><span>Expected result</span><strong>{data.expected_result}</strong>{data.blockers.map((blocker) => <small key={blocker}>{blocker}</small>)}</div>
      {data.requires_biometric ? <p className="resolution-security">One plan approval. Device verification required.</p> : null}
    </CardShell>
  );
}

function ResolutionCompleteCard({ card }) {
  const data = card.data;
  return (
    <CardShell icon={<Check size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="resolution-problem"><span>Problem</span><strong>{data.problem}</strong></div>
      <div className="resolution-section"><span>Completed</span>{data.completed_steps.map((step) => <div className="resolution-row" key={step}><strong>{step}</strong><small>Completed and audited</small></div>)}</div>
      <div className={`resolution-outcome ${data.readiness_status === 'ready_after_plan' ? 'is-ready' : 'is-blocked'}`}><span>Readiness</span><strong>{data.readiness_status === 'ready_after_plan' ? 'Ready to retry payment' : 'Still blocked'}</strong>{data.blockers.map((blocker) => <small key={blocker}>{blocker}</small>)}</div>
      <p className="resolution-security">{data.verification}</p>
    </CardShell>
  );
}

function ScamRiskCard({ card }) {
  const data = card.data;
  return (
    <CardShell icon={<ShieldAlert size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="scam-risk-level"><span>Scam risk</span><strong>{data.risk_level}</strong></div>
      <div className="resolution-section"><span>Matched patterns</span>{data.matched_patterns.map((pattern) => <div className="resolution-row" key={pattern.id}><strong>{pattern.name}</strong>{pattern.red_flags.map((flag) => <small key={flag}>{flag}</small>)}</div>)}</div>
      <div className="resolution-outcome is-blocked"><span>Recommendation</span><strong>{data.recommendation}</strong></div>
      {data.verification_questions.length ? <div className="resolution-section"><span>Before you continue</span>{data.verification_questions.map((question) => <small className="scam-question" key={question}>{question}</small>)}</div> : null}
    </CardShell>
  );
}

function SessionSummaryCard({ card }) {
  return (
    <CardShell icon={<Landmark size={18} />} title={card.title} subtitle={card.subtitle}>
      <div className="summary-kv">
        <div><span>Intent</span><strong>{card.data.primary_intent}</strong></div>
        <div><span>Duration</span><strong>{Math.round(card.data.duration_seconds / 60) || 0} min</strong></div>
        <div><span>Final outcome</span><strong>{card.data.final_outcome}</strong></div>
        <div><span>Tools used</span><strong>{(card.data.tools_called || []).join(', ') || 'None'}</strong></div>
      </div>
    </CardShell>
  );
}

function GenericInfoCard({ card, onAction }) {
  return (
    <CardShell icon={<Landmark size={18} />} title={card.title} subtitle={card.subtitle} actions={card.actions} onAction={onAction}>
      <div className="summary-kv generic-kv">
        {(card.data.items || []).map((item) => (
          <div key={`${item.label}-${item.value}`} className={toneClass(item.tone)}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

const CARD_COMPONENTS = {
  transaction_summary: TransactionSummaryCard,
  card_status: CardStatusCard,
  kyc_status: KycStatusCard,
  account_balance: AccountBalanceCard,
  decline_reason: DeclineReasonCard,
  pending_action: PendingActionCard,
  support_ticket: SupportTicketCard,
  security_result: SecurityResultCard,
  verified_action_receipt: VerifiedActionReceiptCard,
  resolution_plan: ResolutionPlanCard,
  resolution_complete: ResolutionCompleteCard,
  scam_risk: ScamRiskCard,
  session_summary: SessionSummaryCard,
  generic_info: GenericInfoCard,
};

class SummaryCardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Keep a card-level rendering fault isolated. Do not log card data, which
    // may contain banking context; only the error name is useful for diagnosis.
    console.error('Summary card render failed:', error?.name || 'unknown_error');
  }

  render() {
    if (this.state.failed) {
      return (
        <article className="summary-card summary-card-error" role="status">
          <h3>{this.props.title || 'Summary unavailable'}</h3>
          <p>This result could not be displayed as a card. Your voice conversation is still active.</p>
        </article>
      );
    }
    return this.props.children;
  }
}

export const SummaryCardRenderer = memo(function SummaryCardRenderer({ card, onAction }) {
  const safeCard = validateSummaryCard(card);
  const Component = CARD_COMPONENTS[safeCard.type] || GenericInfoCard;
  return <Component card={safeCard} onAction={onAction} />;
});

export const SummaryCardDeck = memo(function SummaryCardDeck({ cards, onAction, loading = false, error = '' }) {
  if (loading) {
    return (
      <section className="summary-card-deck is-loading" aria-label="Loading summaries">
        <div className="summary-card skeleton-card" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="summary-card-deck">
        <article className="summary-card summary-card-error">
          <h3>Summary unavailable</h3>
          <p>{error}</p>
        </article>
      </section>
    );
  }

  if (!cards?.length) return null;

  return (
    <section className="summary-card-deck" aria-label="Visual summaries">
      {cards.map((card, index) => (
        <SummaryCardErrorBoundary key={`${card?.type}-${card?.title}-${index}`} title={card?.title}>
          <SummaryCardRenderer card={card} onAction={onAction} />
        </SummaryCardErrorBoundary>
      ))}
    </section>
  );
});
