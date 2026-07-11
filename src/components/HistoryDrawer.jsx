import { memo, useEffect, useMemo, useState } from 'react';
import { Archive, Clock3, Search, ShieldCheck, X } from 'lucide-react';
import { SummaryCardRenderer } from './SummaryCardRenderer.jsx';

function formatDateTime(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  const minutes = Math.floor(total / 60);
  if (minutes <= 0) return `${total}s`;
  return `${minutes} min`;
}

export const HistoryDrawer = memo(function HistoryDrawer({
  open,
  onClose,
  api,
  onArchive,
}) {
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState('');
  const [outcome, setOutcome] = useState('');
  const [dateFrom, setDateFrom] = useState('');

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '12');
    if (query) params.set('q', query);
    if (intent) params.set('intent', intent);
    if (outcome) params.set('outcome', outcome);
    if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
    return `/api/history?${params.toString()}`;
  }, [dateFrom, intent, outcome, query]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    setLoading(true);
    setError('');
    api(endpoint)
      .then((payload) => {
        if (ignore) return;
        setItems(payload.data || []);
        if (!payload.data?.length) setDetail(null);
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [api, endpoint, open]);

  const loadDetail = async (sessionId) => {
    try {
      setDetailLoading(true);
      setDetail(await api(`/api/history/${sessionId}`));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="history-backdrop" role="dialog" aria-modal="true" aria-label="Conversation history">
      <section className="history-drawer">
      <div className="history-drawer-head">
        <div>
          <span className="eyebrow">History</span>
          <h2>Session history</h2>
        </div>
        <button className="icon-button" onClick={onClose} type="button" aria-label="Close history">
          <X size={18} />
        </button>
      </div>

      <div className="history-filters">
        <label className="history-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search history" />
        </label>
        <select value={intent} onChange={(event) => setIntent(event.target.value)}>
          <option value="">All intents</option>
          <option value="recent_transactions_review">Recent transactions</option>
          <option value="explain_card_decline">Decline reason</option>
          <option value="kyc_status_check">KYC</option>
          <option value="card_status_review">Card status</option>
          <option value="enable_online_payments">Enable online payments</option>
        </select>
        <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
          <option value="">All outcomes</option>
          <option value="enabled">Enabled</option>
          <option value="declined">Declined</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
      </div>

      <div className="history-layout">
        <section className="history-list" aria-label="History sessions">
          {loading ? <div className="history-state">Loading history...</div> : null}
          {!loading && error ? <div className="history-state is-error">{error}</div> : null}
          {!loading && !error && !items.length ? <div className="history-state">No voice sessions yet.</div> : null}
          {!loading && !error && items.map((item) => (
            <button
              className={`history-item ${detail?.data?.session_id === item.session_id ? 'is-active' : ''}`}
              key={item.session_id}
              onClick={() => loadDetail(item.session_id)}
              type="button"
            >
              <strong>{item.title}</strong>
              <span>{formatDateTime(item.updated_at)} · {formatDuration(item.duration_seconds || 0)}</span>
              <small>{item.final_outcome || item.summary}</small>
              <div className="history-item-meta">
                <span>{item.primary_intent}</span>
                {item.biometric_verified ? <span><ShieldCheck size={12} /> Device verified</span> : null}
              </div>
            </button>
          ))}
        </section>

        <section className="history-detail" aria-label="History detail">
          {detailLoading ? <div className="history-state">Loading session...</div> : null}
          {!detailLoading && !detail ? <div className="history-state">Open a session to review its summary cards and actions.</div> : null}
          {!detailLoading && detail ? (
            <>
              <div className="history-detail-head">
                <div>
                  <h3>{detail.data.title}</h3>
                  <p>{detail.data.summary}</p>
                </div>
                <button className="secondary-action" onClick={() => onArchive(detail.data.session_id)} type="button">
                  <Archive size={14} />
                  Archive
                </button>
              </div>

              <div className="history-stat-row">
                <span><Clock3 size={14} /> {formatDateTime(detail.data.created_at)}</span>
                <span>{detail.data.primary_intent}</span>
                <span>{detail.data.final_outcome}</span>
              </div>

              <div className="history-detail-section">
                <strong>Tools used</strong>
                <div className="summary-tags">
                  {(detail.data.tools_called || []).map((tool) => <span key={tool}>{tool}</span>)}
                </div>
              </div>

              <div className="history-detail-section">
                <strong>Visual cards</strong>
                <div className="history-card-stack">
                  {(detail.data.visual_cards || []).map((card, index) => (
                    <SummaryCardRenderer key={`${card.type}-${index}`} card={card} />
                  ))}
                </div>
              </div>

              <div className="history-detail-section">
                <strong>Actions</strong>
                <div className="history-action-list">
                  {(detail.data.actions || []).map((action) => (
                    <div key={action.id} className="history-action-row">
                      <span>{action.display_title}</span>
                      <small>{action.status}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="history-detail-section">
                <strong>Security & audit</strong>
                <div className="history-action-list">
                  {(detail.data.audit || []).map((item) => (
                    <div key={item.id} className="history-action-row">
                      <span>{item.event_type}</span>
                      <small>{formatDateTime(item.timestamp)}</small>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
      </section>
    </div>
  );
});
