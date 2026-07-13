import { memo } from 'react';
import { Activity, CreditCard, Database, RefreshCw, ShieldCheck, Ticket, Wallet, X } from 'lucide-react';

function money(value, currency) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || 'PHP').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)} ${currency || ''}`.trim();
  }
}

function readable(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}

export const DataRoomModal = memo(function DataRoomModal({ open, data, loading, error, onRefresh, onClose }) {
  if (!open) return null;

  return (
    <div className="data-room-backdrop" role="dialog" aria-modal="true" aria-label="Demo data room">
      <section className="data-room-modal">
        <header className="data-room-head">
          <div>
            <span className="eyebrow">Live D1 evidence</span>
            <h2>Demo Data Room</h2>
            <p>A privacy-safe view of the banking records Voges reads and updates.</p>
          </div>
          <div className="data-room-head-actions">
            <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh D1 snapshot"><RefreshCw size={17} /></button>
            <button type="button" onClick={onClose} aria-label="Close demo data room"><X size={18} /></button>
          </div>
        </header>

        {loading ? <div className="data-room-loading" role="status"><RefreshCw size={20} /> Reading the latest D1 state…</div> : null}
        {error ? <div className="data-room-error" role="alert">{error}</div> : null}

        {data ? (
          <div className="data-room-content">
            <section className="data-provenance">
              <div><Database size={18} /><span>Source</span><strong>{data.provenance.database}</strong></div>
              <div><Activity size={18} /><span>Freshness</span><strong>{data.provenance.freshness}</strong></div>
              <div><ShieldCheck size={18} /><span>Privacy</span><strong>Masked fields only</strong></div>
            </section>

            <section className="data-room-section customer-snapshot">
              <div className="data-room-title"><ShieldCheck size={17} /><strong>Customer snapshot</strong></div>
              <div className="data-room-grid">
                <div><span>Demo customer</span><strong>{data.customer?.full_name || 'Unavailable'}</strong></div>
                <div><span>Account</span><strong>{readable(data.customer?.account_status)}</strong></div>
                <div><span>KYC</span><strong>{readable(data.customer?.kyc_status)}</strong></div>
                <div><span>Risk profile</span><strong>{readable(data.customer?.risk_level)}</strong></div>
              </div>
            </section>

            <section className="data-room-section">
              <div className="data-room-title"><Wallet size={17} /><strong>Accounts</strong><small>{data.accounts.length} records</small></div>
              <div className="data-account-list">
                {data.accounts.map((account) => (
                  <div key={`${account.type}-${account.currency}`}>
                    <span><strong>{readable(account.type)}</strong><small>{readable(account.status)}</small></span>
                    <span><strong>{money(account.available_balance, account.currency)}</strong><small>available</small></span>
                  </div>
                ))}
              </div>
            </section>

            <section className="data-room-section">
              <div className="data-room-title"><CreditCard size={17} /><strong>Card controls</strong><small>{data.cards.length} records</small></div>
              <div className="data-card-list">
                {data.cards.map((card) => (
                  <article key={`${card.type}-${card.card_number_masked}`}>
                    <header><strong>{card.card_number_masked}</strong><span className={`data-status is-${card.status}`}>{readable(card.status)}</span></header>
                    <div><span>Online</span><strong>{card.online_payment_enabled ? 'On' : 'Off'}</strong></div>
                    <div><span>International</span><strong>{card.international_payment_enabled ? 'On' : 'Off'}</strong></div>
                    <div><span>Daily limit</span><strong>{money(card.daily_limit, 'PHP')}</strong></div>
                  </article>
                ))}
              </div>
            </section>

            <section className="data-room-section">
              <div className="data-room-title"><Activity size={17} /><strong>Recent transactions</strong><small>{data.counts.transactions} total</small></div>
              <div className="data-transaction-list">
                {data.transactions.map((transaction, index) => (
                  <div key={`${transaction.merchant_name}-${transaction.created_at}-${index}`}>
                    <span><strong>{transaction.merchant_name}</strong><small>{new Date(transaction.created_at).toLocaleString()}</small></span>
                    <span><strong>{money(transaction.amount, transaction.currency)}</strong><small className={`is-${transaction.status}`}>{readable(transaction.status)}</small></span>
                  </div>
                ))}
              </div>
            </section>

            <section className="data-room-section">
              <div className="data-room-title"><Ticket size={17} /><strong>Support activity</strong><small>{data.support_tickets.length} recent</small></div>
              <div className="data-ticket-list">
                {data.support_tickets.length ? data.support_tickets.map((ticket) => (
                  <div key={`${ticket.subject}-${ticket.created_at}`}>
                    <span><strong>{ticket.subject}</strong><small>{new Date(ticket.created_at).toLocaleString()}</small></span>
                    <span className="data-status">{readable(ticket.status)}</span>
                  </div>
                )) : <p>No support tickets for this customer.</p>}
              </div>
            </section>

            <footer className="data-room-footer">
              <span>{data.counts.completed_actions} completed actions</span>
              <span>{data.counts.audit_events} audit events</span>
              <span>Snapshot {new Date(data.generated_at).toLocaleTimeString()}</span>
            </footer>
          </div>
        ) : null}
      </section>
    </div>
  );
});
