import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import {
  Activity,
  ArrowUp,
  Banknote,
  Check,
  Clock3,
  CreditCard,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  Mic,
  MicOff,
  Moon,
  PanelLeft,
  Phone,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { ACTION_TOOL_NAMES, BANKING_TOOLS, SUGGESTED_ACTIONS, TOOL_LABELS } from './banking';
import { SummaryCardDeck } from './components/SummaryCardRenderer.jsx';
import { HistoryDrawer } from './components/HistoryDrawer.jsx';
import {
  classifyRealtimeError,
  coerceRealtimeVoice,
  buildTokenSessionConfig,
  buildSessionUpdateConfig,
  getResponseOutcome,
  isRealtimeConcurrencyError,
} from './realtime.js';
import {
  createRealtimeResponseOrchestrator,
  getFunctionCallsFromResponse,
} from './realtime-orchestrator.js';

const VogesLogo = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand-logo-svg" style={{ flexShrink: 0 }}>
    <defs>
      <linearGradient id="shieldGrad" x1="15%" y1="15%" x2="85%" y2="85%">
        <stop offset="0%" stopColor="var(--ink)" />
        <stop offset="100%" stopColor="var(--muted)" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="var(--ink)" floodOpacity="0.15" />
      </filter>
    </defs>
    <rect x="5" y="5" width="90" height="90" rx="24" fill="var(--surface-strong)" stroke="var(--line)" strokeWidth="1.5" />
    <path d="M50 22 C64 22 75 27 75 27 C75 27 75 58 50 78 C25 58 25 27 25 27 C25 27 36 22 50 22 Z" stroke="url(#shieldGrad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
    <path d="M38 42 C38 42 45 52 50 52 C55 52 62 42 62 42" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M42 49 C42 49 47 57 50 57 C53 57 58 49 58 49" stroke="var(--muted)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="50" cy="35" r="4.5" fill="var(--ink)" />
  </svg>
);

// Build marker — bump this to confirm production has the latest code
const BUILD_TAG = `build-${Date.now().toString(36)}`;
const MAX_TIMELINE_ITEMS = 10;
const AUTO_SCROLL_THRESHOLD = 72;

async function readJsonResponse(response, label) {
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  if (!contentType.includes('application/json')) {
    throw new Error(
      `Network error while processing ${label}. Please ensure the server is running properly.`,
    );
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`${label} returned malformed JSON.`);
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `${label} failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

function normalizeErrorMessage(message) {
  const value = String(message || '').trim();
  if (!value) return 'Something went wrong. Please try again.';
  if (/OPENAI_API_KEY/i.test(value)) return 'Voice service is currently offline.';
  if (/returned HTML instead of JSON/i.test(value)) return 'Voice service is currently offline. Please try again later.';
  if (/Could not reach the OpenAI Realtime API/i.test(value)) return 'Could not reach the secure voice service. Check your connection and try again.';
  if (/OpenAI could not establish the voice connection/i.test(value)) return 'Secure voice could not connect right now. Please try again.';
  if (/Microphone permission was blocked/i.test(value)) return 'Microphone access is blocked. Allow it in your browser settings and try again.';
  if (/No microphone was found/i.test(value)) return 'No microphone was found. Connect one and try again.';
  if (/being used by another app/i.test(value)) return 'Your microphone is in use by another app. Close that app and try again.';
  if (/WebAuthn is not supported/i.test(value)) return 'This browser does not support passkeys on this device.';
  if (/No passkey is registered/i.test(value)) return 'No passkey is set up yet. Add device verification first.';
  if (/Device verification failed/i.test(value)) return 'Could not verify your identity. Please try again.';
  if (/Device verification was cancelled/i.test(value)) return 'Verification was cancelled. No action was completed.';
  if (/Device authentication was cancelled/i.test(value)) return 'Passkey setup was cancelled.';
  if (/challenge is expired|challenge was already used/i.test(value)) return 'That verification step expired. Please try again.';
  if (/Execution token is invalid or expired/i.test(value)) return 'This approval expired before it could finish. Please confirm again.';
  if (/Too many security-sensitive requests/i.test(value)) return 'Too many sensitive requests were made. Please wait a minute and try again.';
  if (/Voice connection was lost/i.test(value)) return 'Voice connection was lost. Check your network and start again.';
  if (/timed out/i.test(value)) return 'The secure voice channel took too long to respond. Please try again.';
  return value;
}

function formatSessionError(error) {
  if (error?.name === 'NotAllowedError') return 'Microphone permission was blocked. Allow microphone access, then try again.';
  if (error?.name === 'NotFoundError') return 'No microphone was found. Connect one, then try again.';
  if (error?.name === 'NotReadableError') return 'Your microphone is being used by another app. Close that app, then try again.';
  return normalizeErrorMessage(error?.message || 'Could not start Voges.');
}

function isUnsupportedRegionError(error) {
  return /country, region, or territory not supported/i.test(String(error?.message || error || ''));
}

function safeVibrate(pattern) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(pattern);
}

// On-screen diagnostic log buffer (ring buffer, max 200 entries)
const DIAG_MAX = 200;
const diagBuffer = [];
const diagListeners = new Set();
function pushDiag(level, tag, data) {
  const entry = {
    id: ++diagCounterGlobal,
    ts: Date.now(),
    level,
    tag,
    data: data === undefined ? null : (typeof data === 'string' ? data : safeStringify(data)),
  };
  diagBuffer.push(entry);
  if (diagBuffer.length > DIAG_MAX) diagBuffer.splice(0, diagBuffer.length - DIAG_MAX);
  diagListeners.forEach((l) => {
    try { l(entry); } catch {}
  });
  return entry;
}
let diagCounterGlobal = 0;
function safeStringify(v) {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, (_, val) => (typeof val === 'bigint' ? val.toString() : val), 2);
  } catch {
    try { return String(v); } catch { return '[unserializable]'; }
  }
}
function truncate(str, max = 600) {
  if (typeof str !== 'string') return str;
  return str.length > max ? `${str.slice(0, max)}…` : str;
}
function setupConsoleBridge() {
  if (typeof window === 'undefined') return () => {};
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  const wrap = (level) => (...args) => {
    try {
      const tag = args[0] && typeof args[0] === 'string' ? args[0] : `console.${level}`;
      const rest = args.slice(typeof args[0] === 'string' ? 1 : 0);
      const payload = rest.length === 0 ? tag : `${tag} ${rest.map((r) => (typeof r === 'string' ? r : safeStringify(r))).join(' ')}`;
      pushDiag(level, tag, truncate(payload, 800));
    } catch {}
  };
  console.log = wrap('log');
  console.info = wrap('info');
  console.warn = wrap('warn');
  console.error = wrap('error');
  return () => {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  };
}
function setupGlobalErrorBridge() {
  if (typeof window === 'undefined') return () => {};
  const onError = (event) => {
    pushDiag('error', 'window.onerror', `${event?.message || 'error'} @ ${event?.filename || ''}:${event?.lineno || ''}:${event?.colno || ''}`);
  };
  const onUnhandled = (event) => {
    pushDiag('error', 'unhandledrejection', event?.reason ? safeStringify(event.reason) : 'unknown rejection');
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandled);

  // Patch fetch to capture any API errors that bypass our normal handlers.
  const origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input?.url || '?');
      try {
        const res = await origFetch(input, init);
        if (!res.ok) {
          let bodyPreview = '';
          try {
            const t = await res.clone().text();
            bodyPreview = t.slice(0, 400);
          } catch {}
          pushDiag('warn', `http.${res.status}`, `${res.status} ${url}${bodyPreview ? ` :: ${bodyPreview}` : ''}`);
        }
        return res;
      } catch (err) {
        pushDiag('error', 'http.fail', `${url} :: ${err?.message || err}`);
        throw err;
      }
    };
  }

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandled);
    if (origFetch) window.fetch = origFetch;
  };
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function energyStyle(level) {
  return {
    '--wave-energy': Math.max(0.06, Number(level || 0)).toFixed(3),
  };
}

function describeActionOutcome(action) {
  if (!action) return 'Action completed successfully.';

  const names = {
    enableOnlinePayments: 'Online payments are now enabled.',
    disableOnlinePayments: 'Online payments are now disabled.',
    enableInternationalPayments: 'International payments are now enabled.',
    disableInternationalPayments: 'International payments are now disabled.',
    freezeCard: 'Your card is now frozen.',
    unfreezeCard: 'Your card is active again.',
    createSupportTicket: 'A support ticket has been created.',
    escalateToHuman: 'A human support request has been created.',
    replaceCard: 'A replacement request has been created.',
    generateFundingInstructions: 'Funding instructions are ready.',
  };

  return names[action] || 'Action completed successfully.';
}

function deriveActionPreview(action, customerContext) {
  if (!action) {
    return {
      currentLabel: 'Review requested change',
      nextLabel: 'Securely apply the new state',
      deviceLabel: 'Confirmation required',
      resourceLabel: 'Selected banking item',
    };
  }

  const payload = action.payload || {};
  const card = customerContext?.cards?.find((item) => item.id === payload.card_id);
  const resourceLabel = card?.masked_number || action.affected_resource || 'Selected banking item';

  if (action.tool_name === 'enableOnlinePayments') {
    return {
      currentLabel: `Online payments: ${card?.online_payment_enabled ? 'On' : 'Off'}`,
      nextLabel: 'Online payments: On',
      deviceLabel: 'Passkey verification required',
      resourceLabel,
    };
  }

  if (action.tool_name === 'disableOnlinePayments') {
    return {
      currentLabel: `Online payments: ${card?.online_payment_enabled ? 'On' : 'Off'}`,
      nextLabel: 'Online payments: Off',
      deviceLabel: action.requires_biometric ? 'Passkey verification required' : 'Confirmation required',
      resourceLabel,
    };
  }

  if (action.tool_name === 'enableInternationalPayments') {
    return {
      currentLabel: `International payments: ${card?.international_payment_enabled ? 'On' : 'Off'}`,
      nextLabel: 'International payments: On',
      deviceLabel: 'Passkey verification required',
      resourceLabel,
    };
  }

  if (action.tool_name === 'disableInternationalPayments') {
    return {
      currentLabel: `International payments: ${card?.international_payment_enabled ? 'On' : 'Off'}`,
      nextLabel: 'International payments: Off',
      deviceLabel: 'Passkey verification required',
      resourceLabel,
    };
  }

  if (action.tool_name === 'freezeCard') {
    return {
      currentLabel: `Card status: ${card?.status || 'Active'}`,
      nextLabel: 'Card status: Locked',
      deviceLabel: 'Passkey verification required',
      resourceLabel,
    };
  }

  if (action.tool_name === 'unfreezeCard') {
    return {
      currentLabel: `Card status: ${card?.status || 'Locked'}`,
      nextLabel: 'Card status: Active',
      deviceLabel: 'Passkey verification required',
      resourceLabel,
    };
  }

  if (action.tool_name === 'createSupportTicket') {
    return {
      currentLabel: 'Support case: Not yet created',
      nextLabel: 'Support case: Open',
      deviceLabel: 'Confirmation required',
      resourceLabel: payload.subject || action.display_title,
    };
  }

  if (action.tool_name === 'replaceCard') {
    return {
      currentLabel: `Card status: ${card?.status || 'Active'}`,
      nextLabel: 'Support case: Replacement queued',
      deviceLabel: 'Passkey verification required',
      resourceLabel,
    };
  }

  return {
    currentLabel: action.display_description || 'Review requested change',
    nextLabel: 'Approved state will be applied',
    deviceLabel: action.requires_biometric ? 'Passkey verification required' : 'Confirmation required',
    resourceLabel,
  };
}

const IconButton = memo(function IconButton({ label, children, onClick, active = false }) {
  return (
    <button className={`icon-button ${active ? 'is-active' : ''}`} onClick={onClick} aria-label={label} title={label} type="button">
      {children}
    </button>
  );
});

const VoiceOrb = memo(function VoiceOrb({ mode, energy, muted, onClick, disabled, isError, isConnected }) {
  return (
    <div className="voice-orb-wrapper">
      {isConnected && !isError && <div className="orb-status-text success">Connected</div>}
      {isError && <div className="orb-status-text danger">Failed</div>}
      <button
        className={`voice-orb mode-${mode} ${muted ? 'is-muted' : ''} ${isConnected && !isError ? 'is-connected' : ''} ${isError ? 'is-error' : ''}`}
        style={{ '--orb-energy': Math.max(0.08, energy).toFixed(3) }}
        onClick={onClick}
        disabled={disabled}
        aria-label={mode === 'idle' ? 'Start voice session' : 'Stop voice session'}
        type="button"
      >
        <div className="voice-orb-core">
          <span className="voice-orb-signal" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} style={{ '--signal-index': index }} />
            ))}
          </span>
        </div>
        <div className="voice-orb-ring ring-one" />
        <div className="voice-orb-ring ring-two" />
        <div className="voice-orb-ring ring-three" />
      </button>
    </div>
  );
});

const WaveBars = memo(function WaveBars({ level, label }) {
  return (
    <div className="wave-bars" aria-label={label} aria-hidden="true">
      {Array.from({ length: 12 }).map((_, index) => (
        <span
          key={index}
          className="wave-bar"
          style={{
            '--bar-index': index,
            '--bar-height': `${18 + Math.max(0.08, level) * 70 + ((index % 4) + 1) * 4}%`,
          }}
        />
      ))}
    </div>
  );
});

const Timeline = memo(function Timeline({ items }) {
  if (!items.length) return null;

  return (
    <section className="conversation-timeline" aria-label="Conversation timeline">
      <span className="section-label">AI activity</span>
      <div className="timeline-list">
        {items.map((item) => (
          <div className={`timeline-item is-${item.state}`} key={item.id}>
            <span className="timeline-dot">
              {item.state === 'processing' ? <LoaderCircle size={13} /> : item.state === 'error' ? <X size={12} /> : <Check size={12} />}
            </span>
            <div>
              <strong>{item.label}</strong>
              {item.detail && <span>{item.detail}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

const DemoProofPanel = memo(function DemoProofPanel({ customerContext, timeline, pendingAction, connected, onOpenSecurity }) {
  const primaryCard = customerContext?.cards?.[0];
  const account = customerContext?.accounts?.[0];
  const recentTimeline = timeline.slice(-4);

  return (
    <section className="demo-proof-panel" aria-label="Banking safety proof">
      <div className="proof-card proof-card-primary">
        <div className="proof-card-head">
          <ShieldCheck size={17} />
          <span>Safety layer</span>
        </div>
        <strong>{pendingAction ? 'Approval is waiting on screen' : 'Policy checks are active'}</strong>
        <p>
          Every write action is reviewed by backend policy before approval, passkey verification, execution, and audit.
        </p>
        <button type="button" onClick={onOpenSecurity}>
          View Security & Policies
        </button>
      </div>

      <div className="proof-card">
        <div className="proof-card-head">
          <Landmark size={17} />
          <span>Customer context</span>
        </div>
        <div className="proof-kv">
          <span>Account</span>
          <strong>{account?.status || customerContext?.customer?.account_status || 'Ready'}</strong>
        </div>
        <div className="proof-kv">
          <span>Card</span>
          <strong>{primaryCard ? `${primaryCard.masked_number} · ${primaryCard.status}` : 'Loaded on demand'}</strong>
        </div>
        <div className="proof-kv">
          <span>KYC</span>
          <strong>{customerContext?.kyc?.status || customerContext?.customer?.kyc_status || 'Available'}</strong>
        </div>
      </div>

      <div className="proof-card">
        <div className="proof-card-head">
          <Activity size={17} />
          <span>Live process</span>
        </div>
        {recentTimeline.length ? (
          <div className="proof-timeline">
            {recentTimeline.map((item) => (
              <div key={item.id} className={`proof-step is-${item.state}`}>
                <span />
                <div>
                  <strong>{item.label}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>{connected ? 'Listening for the next banking request.' : 'Start voice, then ask a banking question.'}</p>
        )}
      </div>
    </section>
  );
});

const MessageList = memo(function MessageList({ messages, liveUserTurn, liveAssistantTurn }) {
  if (!messages.length && !liveUserTurn && !liveAssistantTurn) return null;

  return (
    <section className="message-list" aria-label="Conversation">
      {messages.map((message) => (
        <article className={`message ${message.role} ${message.interrupted ? 'is-interrupted' : ''}`} key={message.id}>
          <div className="message-copy">
            <span className="message-meta">{message.meta}</span>
            <p>{message.content}</p>
          </div>
        </article>
      ))}

      {liveUserTurn?.content && (
        <article className="message user is-live" aria-live="polite">
          <div className="message-copy">
            <span className="message-meta">Listening live</span>
            <p>{liveUserTurn.content}</p>
          </div>
        </article>
      )}

      {liveAssistantTurn?.content && (
        <article className="message assistant is-live" aria-live="polite">
          <div className="message-copy">
            <span className="message-meta">Speaking live</span>
            <p>{liveAssistantTurn.content}</p>
          </div>
        </article>
      )}
    </section>
  );
});

const ApprovalSheet = memo(function ApprovalSheet({ action, actionBusy, customerContext, onCancel, onConfirm }) {
  if (!action) return null;

  const preview = deriveActionPreview(action, customerContext);
  const buttonLabel = actionBusy
    ? (action.requires_biometric ? 'Opening device verification…' : 'Confirming action…')
    : (action.requires_biometric ? 'Verify' : 'Confirm');

  return (
    <div className="approval-backdrop" role="dialog" aria-modal="true" aria-label="Approve secure banking action">
      <section className="approval-sheet">
        <div className="sheet-handle" />
        <div className="approval-head">
          <span className={`risk-badge risk-${action.risk_level}`}>{action.risk_level} risk</span>
          <span className="approval-expiry">Expires {new Date(action.expires_at).toLocaleTimeString()}</span>
        </div>
        <h2>{action.display_title}</h2>
        <p>{action.display_description}</p>
        <div className="approval-grid">
          <div className="approval-tile">
            <span>Action</span>
            <strong>{action.tool_name}</strong>
          </div>
          <div className="approval-tile">
            <span>Current state</span>
            <strong>{preview.currentLabel}</strong>
          </div>
          <div className="approval-tile">
            <span>New state</span>
            <strong>{preview.nextLabel}</strong>
          </div>
          <div className="approval-tile">
            <span>Risk</span>
            <strong>{action.risk_level}</strong>
          </div>
          <div className="approval-tile">
            <span>Policy</span>
            <strong>{action.policy?.reason || 'Allowed by policy checks'}</strong>
          </div>
          <div className="approval-tile">
            <span>Verification</span>
            <strong>{preview.deviceLabel}</strong>
          </div>
        </div>
        <div className="approval-resource">
          <span>For</span>
          <strong>{preview.resourceLabel}</strong>
        </div>
        <div className="sheet-actions">
          <button className="secondary-action" onClick={onCancel} disabled={actionBusy} type="button">
            Cancel
          </button>
          <button className="primary-action" onClick={onConfirm} disabled={actionBusy} type="button">
            {buttonLabel}
          </button>
        </div>
      </section>
    </div>
  );
});

const SummaryModal = memo(function SummaryModal({ open, cards, loading, error, onAction, onClose }) {
  if (!open) return null;

  return (
    <div className="summary-modal-backdrop" role="dialog" aria-modal="true" aria-label="Banking insight">
      <section className="summary-modal-card">
        <div className="summary-modal-head">
          <div>
            <span className="eyebrow">Voges insight</span>
            <h2>Here is what I found</h2>
          </div>
          <IconButton label="Close banking insight" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <SummaryCardDeck cards={cards} loading={loading} error={error} onAction={onAction} />
      </section>
    </div>
  );
});

const DirectVoiceFallbackSheet = memo(function DirectVoiceFallbackSheet({ open, apiKey, error, busy, onChange, onClose, onConnect }) {
  if (!open) return null;

  return (
    <div className="direct-voice-backdrop" role="dialog" aria-modal="true" aria-label="Connect voice directly for this demo">
      <section className="direct-voice-sheet">
        <div className="sheet-handle" />
        <div className="direct-voice-icon"><KeyRound size={20} /></div>
        <span className="eyebrow">Demo connection</span>
        <h2>Connect voice from this device</h2>
        <p>
          Cloudflare&apos;s current region cannot mint a Realtime session. Enter a temporary OpenAI API key to create a one-time browser session directly from this device.
        </p>
        <label className="direct-key-field">
          <span>Temporary API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => onChange(event.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
          />
        </label>
        <small className="direct-key-note">
          The key is used only in this browser to mint a short-lived session, is never stored, and is cleared immediately after use. Use a restricted demo key and rotate it after the presentation.
        </small>
        {error && <div className="direct-key-error" role="alert">{error}</div>}
        <div className="sheet-actions">
          <button className="secondary-action" onClick={onClose} disabled={busy} type="button">Cancel</button>
          <button className="primary-action" onClick={onConnect} disabled={busy || !apiKey.trim()} type="button">
            {busy ? 'Connecting…' : 'Connect voice'}
          </button>
        </div>
      </section>
    </div>
  );
});

const SettingsDrawer = memo(function SettingsDrawer({
  open,
  data,
  actionBusy,
  onClose,
  onSetupPasskey,
  theme,
  onThemeChange,
  voice,
  onVoiceChange,
}) {
  if (!open) return null;

  const isDark = theme === 'dark';
  const policyCount = data?.policy_rules?.length || 0;
  const toolCount = data?.tool_permissions?.length || 0;
  const passkeyCount = data?.passkeys?.length || 0;
  const pendingCount = data?.pending_actions?.length || 0;
  const auditCount = data?.audit?.length || 0;

  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Settings and security">
      <section className="settings-drawer">
      <div className="settings-head">
        <div>
          <span className="eyebrow">Judge view</span>
          <h2>Security &amp; Policies</h2>
          <p>Backend policy, pending actions, passkeys, and audit logs behind the voice experience.</p>
        </div>
        <IconButton label="Close settings" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>

      <div className="security-proof-grid">
        <div>
          <span>Policy rules</span>
          <strong>{policyCount}</strong>
        </div>
        <div>
          <span>Tool permissions</span>
          <strong>{toolCount}</strong>
        </div>
        <div>
          <span>Passkeys</span>
          <strong>{passkeyCount}</strong>
        </div>
        <div>
          <span>Pending actions</span>
          <strong>{pendingCount}</strong>
        </div>
        <div>
          <span>Audit events</span>
          <strong>{auditCount}</strong>
        </div>
      </div>

      <section className="settings-section">
        <div className="settings-title">
          <Settings2 size={16} />
          <strong>Preferences</strong>
        </div>
        <div className="settings-options">
          <div className="settings-option-item">
            <span>Theme</span>
            <div className="theme-toggle-group">
              <button
                className={`theme-toggle-btn ${!isDark ? 'active' : ''}`}
                onClick={() => onThemeChange('light')}
                type="button"
              >
                <Sun size={13} />
                <span>Light</span>
              </button>
              <button
                className={`theme-toggle-btn ${isDark ? 'active' : ''}`}
                onClick={() => onThemeChange('dark')}
                type="button"
              >
                <Moon size={13} />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="settings-option-item">
            <span>Assistant Voice</span>
            <select
              value={voice}
              onChange={(e) => onVoiceChange(e.target.value)}
              className="voice-select"
            >
              <option value="marin">Marin</option>
              <option value="cedar">Cedar</option>
              <option value="alloy">Alloy</option>
              <option value="ash">Ash</option>
              <option value="ballad">Ballad</option>
              <option value="coral">Coral</option>
              <option value="echo">Echo</option>
              <option value="sage">Sage</option>
              <option value="shimmer">Shimmer</option>
              <option value="verse">Verse</option>
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">
          <Fingerprint size={16} />
          <strong>Passkeys</strong>
        </div>
        <p>Biometric data never leaves the device. Voges only receives a secure WebAuthn assertion.</p>
        {data?.passkeys?.length ? (
          <div className="settings-list">
            {data.passkeys.map((key) => (
              <div key={key.id}>
                <span>Platform passkey</span>
                <small>Added {new Date(key.created_at).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        ) : (
          <button className="primary-action" onClick={onSetupPasskey} disabled={actionBusy} type="button">
            Set up device authentication
          </button>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-title">
          <LockKeyhole size={16} />
          <strong>Tool permissions</strong>
        </div>
        <div className="settings-list">
          {data?.tool_permissions?.map((tool) => (
            <div key={tool.name}>
              <span>{tool.name}</span>
              <small>{tool.riskLevel} · {tool.requiresBiometric ? 'passkey required' : 'confirmation'}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">
          <ShieldCheck size={16} />
          <strong>Policy rules</strong>
        </div>
        <div className="settings-list">
          {data?.policy_rules?.slice(0, 8).map((rule) => (
            <div key={rule.code}>
              <span>{rule.code}</span>
              <small>{rule.rule_description || rule.enforcement_level}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">
          <Clock3 size={16} />
          <strong>Pending actions</strong>
        </div>
        <div className="settings-list">
          {data?.pending_actions?.length ? data.pending_actions.slice(0, 6).map((item) => (
            <div key={item.id}>
              <span>{item.display_title}</span>
              <small>{item.risk_level} · {item.status}</small>
            </div>
          )) : (
            <div>
              <span>No pending approval</span>
              <small>Write actions appear here before execution.</small>
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">
          <Activity size={16} />
          <strong>Audit trail</strong>
        </div>
        <div className="settings-list">
          {data?.audit?.slice(0, 8).map((item) => (
            <div key={item.id}>
              <span>{item.event_type.replaceAll('_', ' ')}</span>
              <small>{new Date(item.timestamp).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
      </section>
      </section>
    </div>
  );
});

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('voges-theme') || 'dark');
  const [voice, setVoice] = useState(() => coerceRealtimeVoice(localStorage.getItem('voges-voice')));
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Ready when you are');
  const [error, setError] = useState('');
  const [fatalError, setFatalError] = useState('');
  // Diagnostic log shown on screen (no devtools required)
  const [diagLogs, setDiagLogs] = useState(diagBuffer.slice());
  const [diagOpen, setDiagOpen] = useState(false);
  const [summaryCards, setSummaryCards] = useState([]);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [directVoiceFallbackOpen, setDirectVoiceFallbackOpen] = useState(false);
  const [directVoiceApiKey, setDirectVoiceApiKey] = useState('');
  const [directVoiceError, setDirectVoiceError] = useState('');
  const [customerContext, setCustomerContext] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityData, setSecurityData] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [voiceMode, setVoiceMode] = useState('idle');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0.08);
  const [speakerLevel, setSpeakerLevel] = useState(0.08);
  const [liveUserTurn, setLiveUserTurn] = useState(null);
  const [liveAssistantTurn, setLiveAssistantTurn] = useState(null);
  const [successState, setSuccessState] = useState(null);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState('idle');

  useEffect(() => {
    const modalOpen = summaryModalOpen || Boolean(pendingAction) || settingsOpen || historyOpen || diagOpen || directVoiceFallbackOpen;
    document.body.classList.toggle('modal-open', modalOpen);
    return () => document.body.classList.remove('modal-open');
  }, [diagOpen, directVoiceFallbackOpen, historyOpen, pendingAction, settingsOpen, summaryModalOpen]);

  const peerRef = useRef(null);
  const channelRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const currentSessionIdRef = useRef(null);
  const sessionFinalizedRef = useRef(false);
  // These refs intentionally feed stopSession without changing its identity on
  // every timer/UI update. Adding sessionSeconds or successState to stopSession's
  // dependency list makes React run the unmount cleanup during a live session.
  const sessionSecondsRef = useRef(0);
  const successStateRef = useRef(null);
  const startInProgressRef = useRef(false);
  const sessionTimerRef = useRef(null);
  const disconnectTimerRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const successTimerRef = useRef(null);
  const pendingPromptRef = useRef('');
  const responseActiveRef = useRef(false);
  const responseOrchestratorRef = useRef(null);
  const processedCallIdsRef = useRef(new Set());
  const sessionInitializedRef = useRef(false);
  const liveUserTurnRef = useRef(null);
  const liveAssistantTurnRef = useRef(null);
  const assistantTranscriptPendingRef = useRef([]);
  const assistantTranscriptFinalRef = useRef('');
  const assistantPlaybackStartedRef = useRef(false);
  const inputSpeechActiveRef = useRef(false);
  const audioContextRef = useRef(null);
  const micSourceRef = useRef(null);
  const micAnalyserRef = useRef(null);
  const levelAnimationRef = useRef(null);
  const lastLevelPushRef = useRef(0);
  const stopInProgressRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const greetedRef = useRef(false);

  // Global mouse tracking for dynamic UI interactions
  useEffect(() => {
    // Bridge console.* and global errors into the on-screen log so the user
    // can see what is happening without opening DevTools.
    const restoreConsole = setupConsoleBridge();
    const restoreGlobal = setupGlobalErrorBridge();
    const listener = () => setDiagLogs(diagBuffer.slice());
    diagListeners.add(listener);
    pushDiag('info', 'diag.boot', { build: BUILD_TAG, ua: navigator.userAgent, swSupported: 'serviceWorker' in navigator });
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setDiagOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      diagListeners.delete(listener);
      restoreConsole();
      restoreGlobal();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Auto-open the diagnostics panel whenever a fatal error is set so the user
  // can see what happened without hunting through DevTools.
  useEffect(() => {
    if (fatalError) {
      setDiagOpen(true);
    }
  }, [fatalError]);

  useEffect(() => {
    liveUserTurnRef.current = liveUserTurn;
  }, [liveUserTurn]);

  useEffect(() => {
    liveAssistantTurnRef.current = liveAssistantTurn;
  }, [liveAssistantTurn]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('voges-theme', theme);
  }, [theme]);



  const isDark = theme === 'dark';
  const currentEnergy = voiceMode === 'assistant-speaking'
    ? speakerLevel
    : voiceMode === 'user-speaking'
      ? micLevel
      : connected
        ? Math.max(0.08, micLevel * 0.6)
        : 0.08;

  const pushTimeline = useCallback((label, detail = '', state = 'completed') => {
    setTimeline((current) => [...current, { id: crypto.randomUUID(), label, detail, state }].slice(-MAX_TIMELINE_ITEMS));
  }, []);

  const finalizeTimelineStep = useCallback((state = 'completed') => {
    setTimeline((current) => {
      if (!current.length) return current;
      const next = [...current];
      next[next.length - 1] = { ...next[next.length - 1], state };
      return next;
    });
  }, []);

  const api = useCallback(async (path, options = {}) => readJsonResponse(
    await fetch(path, {
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      ...options,
    }),
    path,
  ), []);

  const loadCustomerContext = useCallback(async () => {
    try {
      const payload = await api('/api/banking/context');
      setCustomerContext(payload.data);
    } catch {
      setCustomerContext(null);
    }
  }, [api]);

  const loadPendingAction = useCallback(async () => {
    try {
      const payload = await api('/api/actions/pending');
      setPendingAction(payload.data?.[0] || null);
    } catch {
      setPendingAction(null);
    }
  }, [api]);

  const loadSecurity = useCallback(async () => {
    try {
      const payload = await api('/api/security/overview');
      setSecurityData(payload.data);
    } catch (loadError) {
      setError(normalizeErrorMessage(loadError.message));
    }
  }, [api]);

  const showSuccess = useCallback((title, description) => {
    const nextSuccess = { title, description };
    successStateRef.current = nextSuccess;
    setSuccessState(nextSuccess);
    clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => {
      successStateRef.current = null;
      setSuccessState(null);
    }, 4200);
  }, []);

  const pushSummaryCard = useCallback((card) => {
    if (!card) return;
    setSummaryCards((current) => [card, ...current.filter((item) => JSON.stringify(item) !== JSON.stringify(card))].slice(0, 6));
    setSummaryModalOpen(true);
    setSummaryLoading(false);
    setSummaryError('');
  }, []);

  const finalizeHistorySession = useCallback((finalOutcome = '') => {
    const sessionId = currentSessionIdRef.current;
    if (!sessionId || sessionFinalizedRef.current) return;
    sessionFinalizedRef.current = true;
    fetch(`/api/history/${sessionId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        duration_seconds: sessionSecondsRef.current,
        final_outcome: finalOutcome,
      }),
    }).catch(() => {});
  }, []);

  const commitMessage = useCallback((message) => {
    const content = message.content?.trim();
    if (!content) return;

    setMessages((current) => {
      const existingIndex = current.findIndex((item) => item.itemId && item.itemId === message.itemId);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = { ...next[existingIndex], ...message, content };
        return next;
      }

      return [...current, { ...message, id: crypto.randomUUID(), content }];
    });
  }, []);

  const finalizeLiveAssistant = useCallback((contentOverride, interrupted = false) => {
    const live = liveAssistantTurnRef.current;
    const pendingText = assistantTranscriptPendingRef.current.map((chunk) => chunk.delta).join('');
    const resolvedContent = interrupted
      ? (contentOverride || live?.content || '')
      : (contentOverride || assistantTranscriptFinalRef.current || `${live?.content || ''}${pendingText}`);

    assistantTranscriptPendingRef.current = [];
    assistantTranscriptFinalRef.current = '';
    assistantPlaybackStartedRef.current = false;
    if (!resolvedContent.trim()) {
      setLiveAssistantTurn(null);
      return;
    }

    commitMessage({
      itemId: live?.itemId || crypto.randomUUID(),
      role: 'assistant',
      meta: interrupted ? 'Interrupted' : 'Voges',
      content: resolvedContent,
      interrupted,
    });
    setLiveAssistantTurn(null);
  }, [commitMessage]);

  const finalizeLiveUser = useCallback((contentOverride) => {
    const live = liveUserTurnRef.current;
    if (!live?.content?.trim() && !contentOverride?.trim()) {
      setLiveUserTurn(null);
      return;
    }

    commitMessage({
      itemId: live?.itemId || crypto.randomUUID(),
      role: 'user',
      meta: 'Voice input',
      content: contentOverride || live.content,
    });
    setLiveUserTurn(null);
  }, [commitMessage]);

  const clearSessionTimers = useCallback(() => {
    clearTimeout(sessionTimerRef.current);
    clearTimeout(disconnectTimerRef.current);
    clearTimeout(connectionTimeoutRef.current);
    sessionTimerRef.current = null;
    disconnectTimerRef.current = null;
    connectionTimeoutRef.current = null;
  }, []);

  const stopMonitoring = useCallback(() => {
    cancelAnimationFrame(levelAnimationRef.current);
    levelAnimationRef.current = null;
    micSourceRef.current?.disconnect();
    micSourceRef.current = null;
    micAnalyserRef.current = null;
    setMicLevel(0.08);
    setSpeakerLevel(0.08);
  }, []);

  const startMonitoring = useCallback(async (stream) => {
    if (!window.AudioContext && !window.webkitAudioContext) return;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
    const context = audioContextRef.current;

    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch {
        return;
      }
    }

    micSourceRef.current?.disconnect();

    const micAnalyser = context.createAnalyser();
    micAnalyser.fftSize = 256;
    const micSource = context.createMediaStreamSource(stream);
    micSource.connect(micAnalyser);
    micSourceRef.current = micSource;
    micAnalyserRef.current = micAnalyser;

    const getLevel = (analyser) => {
      if (!analyser) return 0;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / (data.length || 1);
      return Math.min(1, average / 180);
    };

    const tick = (timestamp) => {
      const mic = getLevel(micAnalyserRef.current);
      // Do not route the remote WebRTC stream through AudioContext. The browser
      // owns that playback path; touching it can destabilize the peer session.
      const speaker = assistantPlaybackStartedRef.current ? 0.42 : 0.08;

      if (timestamp - lastLevelPushRef.current > 66) {
        lastLevelPushRef.current = timestamp;
        setMicLevel((current) => Math.abs(current - mic) > 0.02 ? mic : current * 0.8 + mic * 0.2);
        setSpeakerLevel((current) => Math.abs(current - speaker) > 0.02 ? speaker : current * 0.8 + speaker * 0.2);
      }

      levelAnimationRef.current = requestAnimationFrame(tick);
    };

    cancelAnimationFrame(levelAnimationRef.current);
    levelAnimationRef.current = requestAnimationFrame(tick);
  }, []);

  const stopSession = useCallback(({ silent = false } = {}) => {
    if (stopInProgressRef.current) return;
    stopInProgressRef.current = true;
    const channel = channelRef.current;
    const peer = peerRef.current;
    const stream = streamRef.current;

    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    clearSessionTimers();
    stopMonitoring();
    clearTimeout(successTimerRef.current);

    intentionalStopRef.current = true;
    try { channel?.close(); } catch {}
    try { peer?.close(); } catch {}
    stream?.getTracks().forEach((track) => track.stop());

    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.volume = 1;
    }

    finalizeHistorySession(successStateRef.current?.description || '');
    successStateRef.current = null;
    setSuccessState(null);
    startInProgressRef.current = false;
    responseActiveRef.current = false;
    responseOrchestratorRef.current?.reset();
    responseOrchestratorRef.current = null;
    processedCallIdsRef.current.clear();
    sessionInitializedRef.current = false;
    greetedRef.current = false;
    currentSessionIdRef.current = null;
    setFatalError('');
    setConnecting(false);
    setConnected(false);
    setMuted(false);
    setVoiceMode('idle');
    sessionSecondsRef.current = 0;
    setSessionSeconds(0);
    setLiveUserTurn(null);
    setLiveAssistantTurn(null);
    if (!silent) setStatus('Ready when you are');
    queueMicrotask(() => {
      intentionalStopRef.current = false;
      stopInProgressRef.current = false;
    });
  }, [clearSessionTimers, finalizeHistorySession, stopMonitoring]);

  useEffect(() => () => stopSession({ silent: true }), [stopSession]);

  useEffect(() => {
    Promise.allSettled([loadCustomerContext(), loadPendingAction()]);
  }, [loadCustomerContext, loadPendingAction]);

  useEffect(() => {
    const syncOnlineState = () => setOnline(navigator.onLine);
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);
    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!connected) return undefined;
    const id = setInterval(() => setSessionSeconds((current) => {
      const next = current + 1;
      sessionSecondsRef.current = next;
      return next;
    }), 1000);
    return () => clearInterval(id);
  }, [connected]);

  const sendEvent = useCallback((event) => {
    if (channelRef.current?.readyState !== 'open') return false;
    channelRef.current.send(JSON.stringify(event));
    return true;
  }, []);

  // Realtime response ownership lives here. All greeting, voice-turn, text,
  // function-call follow-up, and approved-action responses must go through this
  // orchestrator. Direct response.create calls reintroduce the active-response
  // race that previously broke production voice sessions.
  const getResponseOrchestrator = useCallback(() => {
    if (!responseOrchestratorRef.current) {
      responseOrchestratorRef.current = createRealtimeResponseOrchestrator({
        send: (event) => sendEvent(event),
        onState: (state) => pushDiag('info', 'rt.orchestrator', state),
        onTimeout: () => {
          setError('Voges did not start the next voice response in time. Please speak again.');
          setStatus('Listening...');
          setVoiceMode('listening');
        },
      });
    }
    return responseOrchestratorRef.current;
  }, [sendEvent]);

  useEffect(() => {
    const safeVoice = coerceRealtimeVoice(voice);
    if (safeVoice !== voice) {
      setVoice(safeVoice);
      return;
    }
    localStorage.setItem('voges-voice', voice);
  }, [voice]);

  const requestVoiceResponse = useCallback((instructions, options) => {
    if (channelRef.current?.readyState !== 'open') return 'ignored';
    return getResponseOrchestrator().request(instructions, options);
  }, [getResponseOrchestrator]);

  const handleOrbPress = useCallback(() => {
    if (!connected) return;
    safeVibrate([8, 24, 8]);
    stopSession();
  }, [connected, stopSession]);

  const endSessionDueToError = useCallback((message) => {
    const normalized = normalizeErrorMessage(message);
    stopSession({ silent: true });
    setFatalError(normalized);
    setError(normalized);
    setStatus('Connection ended');
  }, [stopSession]);

  const sendUserText = useCallback((value, meta = 'Text input') => {
    const prompt = value?.trim();
    if (!prompt || channelRef.current?.readyState !== 'open') return false;

    commitMessage({ role: 'user', meta, content: prompt });
    pushTimeline('Understanding request');
    pushTimeline('Preparing response', '', 'processing');
    setSummaryLoading(true);
    setSummaryError('');
    setSummaryModalOpen(true);
    sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }],
      },
    });
    requestVoiceResponse();
    return true;
  }, [commitMessage, pushTimeline, requestVoiceResponse, sendEvent]);

  const executeRealtimeTool = useCallback(async (item) => {
    const toolName = item.name;
    let args = {};

    try {
      args = item.arguments ? JSON.parse(item.arguments) : {};
    } catch {
      args = {};
    }

    const toolLabel = TOOL_LABELS[toolName] || toolName;
    pushTimeline(toolLabel, '', 'processing');
    setSummaryLoading(true);
    setSummaryError('');

    try {
      const isAction = ACTION_TOOL_NAMES.has(toolName);
      if (isAction) pushTimeline('Applying security policy');
      const response = await fetch(isAction ? '/api/actions/propose' : '/api/banking/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          isAction
            ? { tool_name: toolName, payload: args, user_request: 'Requested through live voice conversation.', session_id: currentSessionIdRef.current }
            : { name: toolName, arguments: args, session_id: currentSessionIdRef.current, user_request: 'Requested through live voice conversation.' },
        ),
      });

      const payload = await readJsonResponse(response, `Banking tool ${toolName}`);
      if (payload.ui) pushSummaryCard(payload.ui);

      finalizeTimelineStep('completed');

      if (isAction && payload.pending_action) {
        setSummaryModalOpen(false);
        setPendingAction(payload.pending_action);
        pushTimeline('Awaiting approval', payload.pending_action.display_title, 'processing');
      } else {
        pushTimeline('Preparing response', '', 'processing');
      }

      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: item.call_id,
          output: JSON.stringify(
            payload.pending_action
              ? {
                  action_proposed: true,
                  title: payload.pending_action.display_title,
                  instruction: 'Ask the customer to review the on-screen confirmation. Do not claim it was completed.',
                  ui: payload.ui || null,
                }
              : { ...(payload.data || payload), ui: payload.ui || null, spoken_response: payload.spoken_response || '' }
          ),
        },
      });
    } catch (toolError) {
      finalizeTimelineStep('error');
      pushTimeline('Tool unavailable', toolLabel, 'error');
      setSummaryLoading(false);
      setSummaryError(normalizeErrorMessage(toolError.message || 'Tool request failed.'));
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: item.call_id,
          output: JSON.stringify({ error: normalizeErrorMessage(toolError.message || 'Tool request failed.') }),
        },
      });
    }

  }, [finalizeTimelineStep, pushSummaryCard, pushTimeline, sendEvent]);

  const handleRealtimeEvent = useCallback(async (event) => {
    if (!event || !event.type) {
      pushDiag('warn', 'rt.unknown', safeStringify(event).slice(0, 400));
      return;
    }
    setLastRealtimeEvent(event.type);
    if (event.type === 'error' || event.type === 'session.error' || event.type === 'conversation.item.error') {
      pushDiag('error', `rt.${event.type}`, safeStringify(event).slice(0, 600));
    } else if (event.type === 'session.created' || event.type === 'session.updated') {
      pushDiag('info', `rt.${event.type}`, {
        session_id: event.session?.id,
        model: event.session?.model,
        voice: event.session?.audio?.output?.voice,
        tools: Array.isArray(event.session?.tools) ? event.session.tools.length : 0,
      });
    } else if (event.type === 'response.created' || event.type === 'response.done' || event.type === 'response.cancelled' || event.type === 'response.failed') {
      pushDiag('info', `rt.${event.type}`, {
        id: event.response?.id,
        status: event.response?.status,
        status_details: event.response?.status_details,
      });
    } else if (event.type.startsWith('conversation.item')) {
      pushDiag('info', `rt.${event.type}`, { item_id: event.item_id, role: event.item?.role });
    } else if (event.type === 'input_audio_buffer.speech_started' || event.type === 'input_audio_buffer.speech_stopped') {
      pushDiag('info', `rt.${event.type}`, { audio_ms: event.audio_start_ms || event.audio_end_ms });
    } else if (event.type === 'rate_limits.updated') {
      pushDiag('info', 'rt.rate_limits', safeStringify(event.rate_limits).slice(0, 200));
    }
    if (event.type === 'session.created') {
      setFatalError('');
      setStatus('Listening...');
      setVoiceMode('listening');
    }

    if (event.type === 'session.updated') {
      setFatalError('');
      setStatus('Listening...');
      setVoiceMode('listening');
    }

    if (event.type === 'session.updated' && !sessionInitializedRef.current) {
      sessionInitializedRef.current = true;
      clearTimeout(connectionTimeoutRef.current);
      startInProgressRef.current = false;
      setConnecting(false);
      setConnected(true);
      setStatus('Listening...');
      setVoiceMode('listening');
      sessionSecondsRef.current = 0;
      setSessionSeconds(0);
      safeVibrate(8);
      pushTimeline('Voice session ready');
      const pendingPrompt = pendingPromptRef.current;
      pendingPromptRef.current = '';
      if (pendingPrompt) {
        sendUserText(pendingPrompt, 'Suggested action');
      } else if (!greetedRef.current) {
        greetedRef.current = true;
        requestVoiceResponse(
          'Greet the customer now in one warm, brief sentence and invite them to ask about their banking.',
          { reason: 'greeting' },
        );
      }
    }

    if (event.type === 'input_audio_buffer.speech_started') {
      inputSpeechActiveRef.current = true;
      const responseSnapshot = getResponseOrchestrator().snapshot();
      if (responseActiveRef.current || responseSnapshot.createPending) {
        const activeResponseId = responseSnapshot.activeResponseId;
        sendEvent({ type: 'response.cancel', ...(activeResponseId ? { response_id: activeResponseId } : {}) });
        sendEvent({ type: 'output_audio_buffer.clear' });
        finalizeLiveAssistant(undefined, true);
        pushTimeline('Interrupted speaking', 'Listening to your new request');
      }
      setStatus('Listening...');
      setVoiceMode('user-speaking');
    }

    if (event.type === 'input_audio_buffer.speech_stopped') {
      inputSpeechActiveRef.current = false;
      setStatus('Thinking...');
      setVoiceMode('thinking');
      pushTimeline('Thinking', '', 'processing');
      requestVoiceResponse('', { reason: 'voice_turn' });
    }

    if (event.type === 'response.created') {
      setFatalError('');
      responseActiveRef.current = true;
      getResponseOrchestrator().responseCreated(event.response);
      assistantPlaybackStartedRef.current = false;
      assistantTranscriptPendingRef.current = [];
      assistantTranscriptFinalRef.current = '';
      setLiveAssistantTurn(null);
      if (audioRef.current) audioRef.current.volume = 1;
      setStatus('Voges is speaking...');
      setVoiceMode('assistant-speaking');
    }

    if (event.type === 'response.done') {
      const outcome = getResponseOutcome(event);
      // OpenAI's supported tool lifecycle is response.done -> output items ->
      // execute tools -> function_call_output items -> one response.create.
      // Do not move execution back to response.output_item.done.
      const functionCalls = getFunctionCallsFromResponse(event.response)
        .filter((item) => !processedCallIdsRef.current.has(item.call_id));
      responseActiveRef.current = false;
      getResponseOrchestrator().responseDone(event.response, { deferFlush: functionCalls.length > 0 });
      if (audioRef.current) audioRef.current.volume = 1;
      setStatus('Listening...');
      setVoiceMode('listening');
      if (outcome.successful || outcome.expectedCancellation) {
        finalizeTimelineStep('completed');
      } else {
        finalizeTimelineStep('error');
        const responseMessage = outcome.message || `The voice response ended with status ${outcome.status}.`;
        pushDiag('warn', 'rt.response.incomplete', outcome);
        setError(normalizeErrorMessage(responseMessage));
      }
      if (functionCalls.length > 0) {
        for (const call of functionCalls) processedCallIdsRef.current.add(call.call_id);
        await Promise.all(functionCalls.map((call) => executeRealtimeTool(call)));
        requestVoiceResponse('', { priority: true, reason: 'tool_followup' });
      }
    }

    if (event.type === 'error' || event.type === 'session.error') {
      const realtimeError = classifyRealtimeError(event);
      getResponseOrchestrator().recoverFromError(event);
      if (isRealtimeConcurrencyError(event)) {
        pushDiag('warn', 'rt.response.race_recovered', realtimeError);
        return;
      }
      const message = normalizeErrorMessage(`${realtimeError.code ? `[${realtimeError.code}] ` : ''}${realtimeError.message}`);
      pushDiag(realtimeError.fatal ? 'error' : 'warn', 'rt.error.classified', realtimeError);
      setError(message);
      if (realtimeError.fatal) {
        stopSession({ silent: true });
        setFatalError(message);
        setStatus('Connection ended');
        safeVibrate([12, 70, 16]);
      }
    }

    if (event.type === 'conversation.item.input_audio_transcription.delta') {
      setLiveUserTurn((current) => ({
        itemId: event.item_id,
        content: current?.itemId === event.item_id ? `${current.content}${event.delta || ''}` : (event.delta || ''),
      }));
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      finalizeLiveUser(event.transcript || liveUserTurnRef.current?.content || '');
    }

    if (event.type === 'response.output_audio_transcript.delta' || event.type === 'response.output_text.delta') {
      const delta = event.delta || '';
      if (!delta) return;
      const itemId = event.item_id || liveAssistantTurnRef.current?.itemId || crypto.randomUUID();
      setLiveAssistantTurn((current) => ({
        itemId,
        content: current?.itemId === itemId ? `${current.content}${delta}` : `${current?.content || ''}${delta}`,
      }));
      assistantTranscriptPendingRef.current.push({ itemId, delta });
    }

    if (event.type === 'output_audio_buffer.started') {
      assistantPlaybackStartedRef.current = true;
      setStatus('Voges is speaking...');
      setVoiceMode('assistant-speaking');
    }

    if (event.type === 'output_audio_buffer.stopped' || event.type === 'output_audio_buffer.cleared') {
      assistantPlaybackStartedRef.current = false;
      if (connected) {
        setStatus('Listening...');
        setVoiceMode('listening');
      }
    }

    if (event.type === 'response.output_audio.delta') {
      assistantPlaybackStartedRef.current = true;
    }

    if (event.type === 'response.output_audio_transcript.done') {
      assistantTranscriptFinalRef.current = event.transcript || '';
    }

    if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
      finalizeLiveAssistant(undefined, false);
      setVoiceMode('thinking');
      pushDiag('info', 'rt.tool.waiting_for_response_done', { call_id: event.item.call_id, name: event.item.name });
    }
  }, [
    connected,
    executeRealtimeTool,
    finalizeLiveAssistant,
    finalizeLiveUser,
    finalizeTimelineStep,
    getResponseOrchestrator,
    pushTimeline,
    requestVoiceResponse,
    sendEvent,
    sendUserText,
  ]);

  const startSession = useCallback(async ({ directApiKey = '' } = {}) => {
    if (startInProgressRef.current || connecting || connected) return;
    if (!online) {
      setError('You appear to be offline. Reconnect to start a secure voice session.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setError('This browser does not support the microphone or WebRTC required for Voges.');
      return;
    }

    startInProgressRef.current = true;
    setConnecting(true);
    setError('');
    setFatalError('');
    setStatus('Requesting microphone…');
    setVoiceMode('connecting');
    let remoteDescriptionApplied = false;

    try {
      let token;
      const trimmedDirectApiKey = directApiKey.trim();

      if (trimmedDirectApiKey) {
        setStatus('Creating a direct demo session…');
        const directTokenResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${trimmedDirectApiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Safety-Identifier': `voges-demo-${crypto.randomUUID()}`,
          },
          body: JSON.stringify({ session: buildTokenSessionConfig({ voice }) }),
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        token = await readJsonResponse(directTokenResponse, 'Direct Realtime token endpoint');
        // The browser-only key is intentionally never persisted or logged.
        setDirectVoiceApiKey('');
        setDirectVoiceError('');
        setDirectVoiceFallbackOpen(false);
        currentSessionIdRef.current = null;
      } else {
        try {
          const tokenResponse = await fetch('/api/realtime/token', {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
          });
          token = await readJsonResponse(tokenResponse, 'Realtime token endpoint');
        } catch (tokenError) {
          if (isUnsupportedRegionError(tokenError)) {
            setDirectVoiceError('Cloudflare cannot reach the Realtime service from its current region.');
            setDirectVoiceFallbackOpen(true);
            setStatus('Direct demo connection required');
            setVoiceMode('idle');
            return;
          }
          throw tokenError;
        }
        currentSessionIdRef.current = token.session_id || null;
      }
      const ephemeralKey = token.value;
      if (!ephemeralKey) throw new Error('The realtime token response was empty.');
      sessionFinalizedRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      await startMonitoring(stream);

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.onconnectionstatechange = () => {
        pushDiag('info', 'peer.connectionState', peer.connectionState);
        if (peerRef.current !== peer) return;
        if (peer.connectionState === 'connected') {
          clearTimeout(disconnectTimerRef.current);
          setStatus('Configuring secure voice...');
          setVoiceMode('connecting');
          return;
        }
        if (peer.connectionState === 'disconnected') {
          setStatus('Reconnecting secure voice…');
          setVoiceMode('connecting');
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = setTimeout(() => {
            if (peerRef.current === peer && peer.connectionState === 'disconnected') {
              endSessionDueToError('Voice connection was lost. Check your network and start a new conversation.');
            }
          }, 8_000);
        }
        if (peer.connectionState === 'failed') {
          endSessionDueToError('Voice connection failed. Check your network and start a new conversation.');
        }
      };

      peer.oniceconnectionstatechange = () => {
        pushDiag('info', 'peer.iceConnectionState', peer.iceConnectionState);
        if (peer.iceConnectionState === 'failed') {
          try { peer.restartIce(); } catch {}
        }
      };

      peer.ontrack = (event) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.play().then(() => {
          pushDiag('info', 'remote_audio.playing', {
            readyState: audioRef.current?.readyState,
            muted: audioRef.current?.muted,
          });
        }).catch((audioError) => {
          pushDiag('warn', 'remote_audio.play_failed', String(audioError?.message || audioError));
        });
      };

      stream.getAudioTracks().forEach((track) => peer.addTrack(track));

      const channel = peer.createDataChannel('oai-events');
      channelRef.current = channel;
      pushDiag('info', 'channel.created', { readyState: channel.readyState });
      channel.addEventListener('open', () => {
        pushDiag('info', 'channel.open', null);
        if (channelRef.current !== channel) return;
        const safeVoice = coerceRealtimeVoice(voice);
        if (safeVoice !== voice) setVoice(safeVoice);
        setStatus('Configuring secure voice...');
        setVoiceMode('connecting');
        sessionInitializedRef.current = false;
        clearTimeout(connectionTimeoutRef.current);
        sessionTimerRef.current = setTimeout(() => {
          if (channelRef.current === channel) {
            endSessionDueToError('This voice session reached its 60-minute limit. Start a new conversation to continue.');
          }
        }, 59 * 60 * 1000);
        // The core session (voice, instructions, VAD) was already configured
        // server-side when the token was minted. This update only registers the
        // banking tools, so the session works even if this event is delayed.
        sendEvent({
          type: 'session.update',
          session: buildSessionUpdateConfig({
            voice: safeVoice,
            tools: BANKING_TOOLS,
          }),
        });
      });

      channel.addEventListener('error', (event) => {
        pushDiag('error', 'channel.error', safeStringify(event).slice(0, 400));
        endSessionDueToError('The realtime voice channel reported an error. Start a new conversation to reconnect.');
      });

      channel.addEventListener('closing', () => {
        pushDiag('warn', 'channel.closing', null);
      });

      channel.addEventListener('message', (event) => {
        if (channelRef.current !== channel || intentionalStopRef.current) return;
        try {
          const parsed = JSON.parse(event.data);
          // Only push periodic counter for non-torrent events to avoid log spam
          if (parsed && parsed.type && !/^response\.output_audio\.delta$|^response\.output_audio_transcript\.delta$/.test(parsed.type)) {
            pushDiag('info', `rx.${parsed.type}`, null);
          }
          void handleRealtimeEvent(parsed);
        } catch (parseError) {
          pushDiag('error', 'channel.parse', String(parseError?.message || parseError));
          setError('Received an invalid realtime event.');
        }
      });

      channel.addEventListener('close', () => {
        pushDiag('warn', 'channel.close', {
          intentional: intentionalStopRef.current,
          peerConnectionState: peer.connectionState,
          iceConnectionState: peer.iceConnectionState,
          channelReadyState: channel.readyState,
        });
        if (channelRef.current === channel && !intentionalStopRef.current) {
          endSessionDueToError('The realtime voice channel closed. Start a new conversation to reconnect.');
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      pushDiag('info', 'sdp.post.start', null);
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      });
      pushDiag('info', 'sdp.post.done', { status: sdpResponse.status });
      const answerSdp = await sdpResponse.text();
      if (!sdpResponse.ok) {
        pushDiag('error', 'sdp.post.failed', { status: sdpResponse.status, body: (answerSdp || '').slice(0, 500) });
        throw new Error(`OpenAI could not establish the voice connection (${sdpResponse.status}).`);
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      remoteDescriptionApplied = true;
      setStatus('Opening secure voice channel…');
      connectionTimeoutRef.current = setTimeout(() => {
        if (channelRef.current === channel && (channel.readyState !== 'open' || !sessionInitializedRef.current)) {
          endSessionDueToError('Voice session configuration timed out. Check your network and try again.');
        }
      }, 20_000);
    } catch (sessionError) {
      stopSession({ silent: true });
      const message = formatSessionError(sessionError);
      if (directApiKey.trim()) {
        setDirectVoiceError(message);
        setDirectVoiceFallbackOpen(true);
        setError('');
        setFatalError('');
      } else {
        setError(message);
        setFatalError(message);
      }
      setStatus('Ready when you are');
      setVoiceMode('idle');
    } finally {
      if (!remoteDescriptionApplied) {
        startInProgressRef.current = false;
        setConnecting(false);
      }
    }
  }, [
    connected,
    connecting,
    endSessionDueToError,
    handleRealtimeEvent,
    online,
    pushTimeline,
    sendEvent,
    startMonitoring,
    stopSession,
    voice,
  ]);

  const setupPasskey = useCallback(async () => {
    try {
      setActionBusy(true);
      if (!window.PublicKeyCredential) throw new Error('WebAuthn is not supported by this browser.');
      const options = await api('/api/webauthn/register/options', { method: 'POST' });
      const response = await startRegistration({ optionsJSON: options });
      await api('/api/webauthn/register/verify', { method: 'POST', body: JSON.stringify({ response }) });
      safeVibrate([10, 40, 10]);
      pushTimeline('Device authentication ready');
      await loadSecurity();
      showSuccess('Passkey ready', 'Device verification is now available for sensitive actions.');
    } catch (setupError) {
      setError(normalizeErrorMessage(setupError.name === 'NotAllowedError' ? 'Device authentication was cancelled.' : setupError.message));
    } finally {
      setActionBusy(false);
    }
  }, [api, loadSecurity, pushTimeline, showSuccess]);

  const finishAction = useCallback(async (actionId, executionToken, toolName) => {
    const result = await api(`/api/actions/${actionId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ execution_token: executionToken }),
    });
    if (result.ui) pushSummaryCard(result.ui);
    safeVibrate([12, 45, 12]);
    setPendingAction(null);
    pushTimeline('Action completed', describeActionOutcome(toolName));
    showSuccess('Action completed', describeActionOutcome(toolName));
    await Promise.all([loadCustomerContext(), loadPendingAction(), loadSecurity()]);
    requestVoiceResponse(
      `The customer-approved, device-verified banking action completed successfully. Explain this exact result naturally and concisely: ${JSON.stringify(result.data)}`,
    );
  }, [api, loadCustomerContext, loadPendingAction, loadSecurity, pushSummaryCard, pushTimeline, requestVoiceResponse, showSuccess]);

  const resolvePendingAction = useCallback(async () => {
    if (!pendingAction) return;

    try {
      setActionBusy(true);
      pushTimeline('Confirming action');
      const confirmed = await api(`/api/actions/${pendingAction.id}/confirm`, { method: 'POST' });
      const action = { ...confirmed.data, payload: pendingAction.payload || {}, policy: pendingAction.policy || null };
      setPendingAction(action);
      safeVibrate(8);

      if (!action.requires_biometric) {
        await finishAction(action.id, confirmed.data.execution_token, action.tool_name);
        return;
      }

      pushTimeline('Checking your identity');
      const options = await api('/api/webauthn/authenticate/options', {
        method: 'POST',
        body: JSON.stringify({ pending_action_id: action.id }),
      });
      const response = await startAuthentication({ optionsJSON: options });
      const verification = await api('/api/webauthn/authenticate/verify', {
        method: 'POST',
        body: JSON.stringify({ pending_action_id: action.id, response }),
      });
      safeVibrate([8, 30, 14]);
      pushTimeline('Identity verified');
      await finishAction(action.id, verification.execution_token, action.tool_name);
    } catch (actionError) {
      pushTimeline('Verification not completed', '', 'error');
      const message = actionError.name === 'NotAllowedError'
        ? 'Device verification was cancelled. No action was executed.'
        : actionError.message;
      setError(normalizeErrorMessage(message));
    } finally {
      setActionBusy(false);
    }
  }, [api, finishAction, pendingAction, pushTimeline]);

  const cancelPendingAction = useCallback(async () => {
    try {
      if (!pendingAction) return;
      await api(`/api/actions/${pendingAction.id}/cancel`, { method: 'POST' });
      setPendingAction(null);
      pushTimeline('Action cancelled');
      safeVibrate(6);
      await loadPendingAction();
    } catch (cancelError) {
      setError(normalizeErrorMessage(cancelError.message));
    }
  }, [api, loadPendingAction, pendingAction, pushTimeline]);

  const sendText = useCallback((event) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || !connected) return;
    sendUserText(value);
    setText('');
  }, [connected, sendUserText, text]);

  const useSuggestedAction = useCallback((prompt) => {
    if (connected) {
      sendUserText(prompt, 'Suggested action');
      return;
    }

    pendingPromptRef.current = prompt;
    pushTimeline('Preparing voice session');
    startSession();
  }, [connected, pushTimeline, sendUserText, startSession]);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setTimeline([]);
    setLiveUserTurn(null);
    setLiveAssistantTurn(null);
    setError('');
    setFatalError('');
    setSummaryCards([]);
    setSummaryModalOpen(false);
    setSummaryError('');
    setSummaryLoading(false);
    setSuccessState(null);
  }, []);

  const explainTransactionFromSummary = useCallback(async (action) => {
    try {
      setSummaryLoading(true);
      setSummaryError('');
      setSummaryModalOpen(true);
      pushTimeline('Explaining transaction', action?.payload?.merchant || '', 'processing');
      const payload = await api('/api/banking/tools', {
        method: 'POST',
        body: JSON.stringify({
          name: 'explainDeclineReason',
          arguments: action?.payload || {},
          session_id: currentSessionIdRef.current,
          user_request: 'Explain the selected transaction from the banking insight.',
        }),
      });
      finalizeTimelineStep('completed');
      if (payload.ui) pushSummaryCard(payload.ui);
      if (connected) {
        requestVoiceResponse(
          `Explain this selected declined payment naturally and concisely for the customer. Use the verified banking result only: ${JSON.stringify(payload.data)}`,
        );
      }
    } catch (explainError) {
      finalizeTimelineStep('error');
      setSummaryLoading(false);
      setSummaryError(normalizeErrorMessage(explainError.message || 'Could not explain that transaction.'));
    }
  }, [api, connected, finalizeTimelineStep, pushSummaryCard, pushTimeline, requestVoiceResponse]);

  const handleSummaryAction = useCallback((action) => {
    setSummaryModalOpen(false);
    if (!action?.action) return;
    if (action.action === 'tool:explain_decline_reason' || action.action === 'voice:explain_transaction') {
      void explainTransactionFromSummary(action);
      return;
    }
    if (action.action === 'history:transactions') {
      setHistoryOpen(true);
    }
  }, [explainTransactionFromSummary]);

  const handleArchiveHistory = useCallback(async (sessionId) => {
    try {
      await api(`/api/history/${sessionId}/archive`, { method: 'POST' });
      setHistoryOpen(false);
      showSuccess('History archived', 'The session was removed from history view while audit logs remain preserved.');
    } catch (archiveError) {
      setError(normalizeErrorMessage(archiveError.message));
    }
  }, [api, showSuccess]);

  const emptyStateVisible = !messages.length && !liveUserTurn?.content && !liveAssistantTurn?.content;

  return (
    <main className="app-shell">
      <audio ref={audioRef} autoPlay />

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-brand" onClick={resetConversation} title="Reset conversation">
            <VogesLogo size={34} />
            <span>Voges</span>
          </div>

          {/* Topbar context removed to clean up UI strings */}

          <div className="topbar-actions">
            <IconButton
              label="History"
              onClick={() => setHistoryOpen(true)}
            >
              <Clock3 size={18} />
            </IconButton>
            <IconButton
              label="New conversation"
              onClick={resetConversation}
            >
              <Plus size={18} />
            </IconButton>
            <IconButton
              label="Security & Policies"
              onClick={() => {
                setSettingsOpen(true);
                loadSecurity();
              }}
            >
              <Settings2 size={18} />
            </IconButton>
            <IconButton
              label="Diagnostics"
              onClick={() => setDiagOpen(true)}
            >
              <Terminal size={18} />
            </IconButton>
          </div>
        </header>

        <div className="conversation-scroll">
          <div className="conversation-stage conversation-stage-minimal">
            {!online && (
              <div className="network-banner">
                <span>You are offline. Reconnect to use secure voice and live banking tools.</span>
              </div>
            )}

            <section className="voice-focus">
              <p className="kicker">Voice-first concierge</p>
              <h1>{connected ? 'Voges is with you in real time.' : 'Talk to Voges.'}</h1>
              <p className="welcome-copy">
                {connected
                  ? 'Just speak naturally. Voges listens, thinks, and replies by voice.'
                  : 'A calm, voice-first banking concierge with policy checks and passkeys built in.'}
              </p>

              <div className="voice-focus-orb">
                <VoiceOrb
                  mode={voiceMode}
                  energy={currentEnergy}
                  muted={muted}
                  onClick={connected ? handleOrbPress : startSession}
                  disabled={connecting || !online}
                  isError={!!fatalError}
                  isConnected={connected}
                />
              </div>

              <div className="voice-focus-wave">
                <WaveBars
                  level={voiceMode === 'assistant-speaking' ? speakerLevel : micLevel}
                  label={voiceMode === 'assistant-speaking' ? 'Assistant waveform' : 'Microphone waveform'}
                />
              </div>

              <div className="status-line minimal-status" aria-live="polite">
                <span className={`status-indicator ${connected ? 'is-live' : ''}`} />
                <span>{status}</span>
                {connected && <span className="status-time"><Clock3 size={13} /> {formatDuration(sessionSeconds)}</span>}
                {connected && <span className="status-chip">Live mic</span>}
              </div>

              {(fatalError || error) && (
                <div className="fatal-banner" role="alert" data-testid="voges-error-banner">
                  <strong>{fatalError ? 'Voice session ended' : 'Voice notice'}</strong>
                  <span>{fatalError || error}</span>
                </div>
              )}

              <div className="control-hint control-hint-centered">
                {connecting
                  ? 'Opening secure channel'
                  : connected
                    ? 'Tap the orb to stop the voice session'
                    : 'Tap the orb to start a secure session'}
              </div>

              {(successState || error) && (
                <div className="voice-feedback-stack">
                  {successState && (
                    <div className="success-banner" role="status" aria-live="polite">
                      <span className="success-mark"><Check size={14} /></span>
                      <div>
                        <strong>{successState.title}</strong>
                        <span>{successState.description}</span>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="error-banner" role="alert">
                      <span>{error}</span>
                      <button onClick={() => setError('')} aria-label="Dismiss error" type="button">
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {emptyStateVisible && (
              <section className="quick-actions" aria-label="Suggested banking actions">
                {SUGGESTED_ACTIONS.map((action) => (
                  <button className="quick-action-card" key={action.label} onClick={() => useSuggestedAction(action.prompt)} type="button">
                    <span className="quick-action-topline">
                      <span>{action.group}</span>
                      <small className={`quick-risk risk-${String(action.risk || 'low').toLowerCase()}`}>{action.risk}</small>
                    </span>
                    <span className="quick-action-title">
                      <Banknote size={15} />
                      <strong>{action.label}</strong>
                    </span>
                    <small>{action.intent}</small>
                    <em>{action.proof}</em>
                  </button>
                ))}
              </section>
            )}

            <DemoProofPanel
              customerContext={customerContext}
              timeline={timeline}
              pendingAction={pendingAction}
              connected={connected}
              onOpenSecurity={() => {
                setSettingsOpen(true);
                loadSecurity();
              }}
            />

          </div>
        </div>

        <DiagnosticsDrawer
          open={diagOpen}
          onClose={() => setDiagOpen(false)}
          logs={diagLogs}
          onClear={() => { diagBuffer.length = 0; setDiagLogs([]); }}
          onCopy={async () => {
            const text = diagBuffer
              .map((e) => `[${new Date(e.ts).toISOString()}] ${e.level.toUpperCase()} ${e.tag} ${e.data !== null && e.data !== undefined ? (typeof e.data === 'string' ? e.data : JSON.stringify(e.data)) : ''}`)
              .join('\n');
            try { await navigator.clipboard.writeText(text); pushDiag('info', 'diag.copied', { bytes: text.length }); } catch (err) { pushDiag('warn', 'diag.copyFailed', String(err?.message || err)); }
          }}
          onForceReload={async () => {
            try {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const r of regs) {
                  try { await r.unregister(); } catch {}
                }
              }
              if (typeof caches !== 'undefined' && caches.keys) {
                const keys = await caches.keys();
                for (const k of keys) { try { await caches.delete(k); } catch {} }
              }
            } catch (err) {
              pushDiag('warn', 'diag.unregisterFailed', String(err?.message || err));
            }
            window.location.reload();
          }}
        />
        <SummaryModal
          open={summaryModalOpen && !pendingAction}
          cards={summaryCards}
          loading={summaryLoading}
          error={summaryError}
          onAction={(action) => {
            setSummaryModalOpen(false);
            handleSummaryAction(action);
          }}
          onClose={() => setSummaryModalOpen(false)}
        />
        <DirectVoiceFallbackSheet
          open={directVoiceFallbackOpen}
          apiKey={directVoiceApiKey}
          error={directVoiceError}
          busy={connecting}
          onChange={(value) => {
            setDirectVoiceApiKey(value);
            setDirectVoiceError('');
          }}
          onClose={() => {
            if (connecting) return;
            setDirectVoiceApiKey('');
            setDirectVoiceError('');
            setDirectVoiceFallbackOpen(false);
          }}
          onConnect={() => startSession({ directApiKey: directVoiceApiKey })}
        />
        <ApprovalSheet
          action={pendingAction}
          actionBusy={actionBusy}
          customerContext={customerContext}
          onCancel={cancelPendingAction}
          onConfirm={resolvePendingAction}
        />
        <HistoryDrawer
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          api={api}
          onArchive={handleArchiveHistory}
        />

        <SettingsDrawer
          open={settingsOpen}
          data={securityData}
          actionBusy={actionBusy}
          onClose={() => setSettingsOpen(false)}
          onSetupPasskey={setupPasskey}
          theme={theme}
          onThemeChange={setTheme}
          voice={voice}
          onVoiceChange={(next) => setVoice(coerceRealtimeVoice(next))}
        />
      </section>
    </main>
  );
}

function RealtimeHealthBar({ build, connected, connecting, lastEvent, fatalError, logs, onOpen }) {
  const state = fatalError ? 'failed' : connected ? 'connected' : connecting ? 'connecting' : 'idle';
  // Only show when not idle - and as a tiny indicator
  if (state === 'idle' && !fatalError) return null;
  return (
    <button
      className={`realtime-health-bar is-${state}`}
      onClick={onOpen}
      type="button"
      aria-label="Open realtime diagnostics"
      title={`Realtime: ${state} | ${build} | Last: ${lastEvent}`}
    >
      <span className="diag-dot" />
      <span>Realtime: {state}</span>
    </button>
  );
}

// ───────────────────────── On-screen diagnostics panel ─────────────────────────
function DiagnosticsDrawer({ open, onClose, logs, onClear, onCopy, onForceReload }) {
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logs, open]);
  if (!open) return null;
  const levelClass = (l) => `diag-row diag-${l}`;
  return (
    <div className="diag-drawer" role="dialog" aria-label="Diagnostics" data-testid="voges-diagnostics">
      <div className="diag-header">
        <div className="diag-title">
          <Terminal size={16} />
          <strong>Diagnostics</strong>
          <span className="diag-count">{logs.length} entries</span>
        </div>
        <div className="diag-actions">
          <button type="button" className="diag-btn" onClick={onCopy} title="Copy logs to clipboard">
            <span>Copy</span>
          </button>
          <button type="button" className="diag-btn" onClick={onForceReload} title="Unregister service worker and reload">
            <span>Force reload</span>
          </button>
          <button type="button" className="diag-btn" onClick={onClear} title="Clear log buffer">
            <Trash2 size={14} />
          </button>
          <button type="button" className="diag-btn diag-close" onClick={onClose} aria-label="Close diagnostics">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="diag-body" ref={bodyRef}>
        {logs.length === 0 && <div className="diag-empty">No log entries yet.</div>}
        {logs.map((entry) => (
          <div key={entry.id} className={levelClass(entry.level)}>
            <span className="diag-time">{new Date(entry.ts).toLocaleTimeString()}</span>
            <span className={`diag-level diag-level-${entry.level}`}>{entry.level}</span>
            <span className="diag-tag">{entry.tag}</span>
            {entry.data !== null && entry.data !== undefined && (
              <pre className="diag-data">{typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
