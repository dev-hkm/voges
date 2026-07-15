import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Code2,
  Database,
  Fingerprint,
  Mic2,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

const CAPABILITIES = [
  {
    index: '01',
    title: 'Realtime conversation',
    copy: 'Natural speech-to-speech banking conversations over browser WebRTC, powered by GPT Realtime 2.1.',
    icon: Mic2,
  },
  {
    index: '02',
    title: 'Resolution Autopilot',
    copy: 'Investigates verified banking context, identifies blockers, and builds an ordered plan instead of stopping at an explanation.',
    icon: Workflow,
  },
  {
    index: '03',
    title: 'Bounded execution',
    copy: 'Every write action is allowlisted, schema-validated, re-evaluated by deterministic policy, and executed only after approval.',
    icon: ShieldCheck,
  },
  {
    index: '04',
    title: 'Cryptographic approval',
    copy: 'High-risk actions use real WebAuthn assertions from Windows Hello, Face ID, Touch ID, or another platform authenticator.',
    icon: Fingerprint,
  },
];

const FLOW = ['Understand', 'Investigate', 'Propose', 'Verify', 'Execute', 'Audit'];

function VogesMark({ size = 38 }) {
  return (
    <svg className="landing-mark" width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="27" fill="currentColor" />
      <path d="M50 20c15 0 27 6 27 6s0 34-27 55C23 60 23 26 23 26s12-6 27-6Z" stroke="#050505" strokeWidth="5" strokeLinejoin="round" />
      <path d="M37 41c5 9 9 13 13 13s8-4 13-13M42 51c3 6 6 9 8 9s5-3 8-9" stroke="#050505" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="34" r="4" fill="#050505" />
    </svg>
  );
}

function LiveArchitecture() {
  return (
    <div className="landing-system-card reveal" aria-label="Voges safety architecture">
      <div className="system-card-top">
        <span>LIVE PRODUCT ARCHITECTURE</span>
        <span className="system-live"><i /> SERVER VERIFIED</span>
      </div>
      <div className="system-orbit" aria-hidden="true">
        <div className="system-orbit-ring ring-one" />
        <div className="system-orbit-ring ring-two" />
        <div className="system-orbit-core"><VogesMark size={74} /></div>
        <span className="orbit-label label-voice">VOICE INTENT</span>
        <span className="orbit-label label-policy">POLICY</span>
        <span className="orbit-label label-proof">PASSKEY</span>
        <span className="orbit-label label-data">D1 DATA</span>
      </div>
      <div className="system-card-foot">
        <div><span>MODEL</span><strong>GPT Realtime 2.1</strong></div>
        <div><span>TRANSPORT</span><strong>WebRTC</strong></div>
        <div><span>EXECUTION</span><strong>Cloudflare D1</strong></div>
      </div>
    </div>
  );
}

function ResolutionDemo() {
  return (
    <article className="resolution-demo reveal">
      <header>
        <div><ScanLine size={17} /><span>RESOLUTION AUTOPILOT</span></div>
        <span className="sample-label">SAMPLE DATA SCENARIO</span>
      </header>
      <div className="resolution-problem-landing">
        <span>PROBLEM</span>
        <h3>Netflix payment failed.</h3>
      </div>
      <div className="resolution-columns">
        <div>
          <span className="resolution-label">VERIFIED BLOCKERS</span>
          <p><i className="dot-red" /> Card is locked</p>
          <p><i className="dot-red" /> Online controls require review</p>
        </div>
        <div>
          <span className="resolution-label">ORDERED PLAN</span>
          <p><b>01</b> Unlock affected card</p>
          <p><b>02</b> Re-evaluate payment readiness</p>
        </div>
      </div>
      <footer>
        <span><Fingerprint size={16} /> One bounded approval</span>
        <strong>Device verification required</strong>
      </footer>
    </article>
  );
}

export default function LandingPage() {
  const rootRef = useRef(null);
  const [system, setSystem] = useState({ online: null, access: null });

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    document.body.classList.add('landing-active');

    const root = rootRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealItems = root?.querySelectorAll('.reveal') || [];
    let observer;

    if (reducedMotion) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    } else {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.14 });
      revealItems.forEach((item) => observer.observe(item));
    }

    let frame = 0;
    const onPointerMove = (event) => {
      if (reducedMotion) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root?.style.setProperty('--landing-pointer-x', `${event.clientX}px`);
        root?.style.setProperty('--landing-pointer-y', `${event.clientY}px`);
      });
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    Promise.allSettled([
      fetch('/api/health', { headers: { Accept: 'application/json' }, cache: 'no-store' }).then((response) => response.json()),
      fetch('/api/realtime/access', { headers: { Accept: 'application/json' }, cache: 'no-store' }).then((response) => response.json()),
    ]).then(([health, access]) => {
      setSystem({
        online: health.status === 'fulfilled' ? Boolean(health.value?.ok) : false,
        access: access.status === 'fulfilled' ? access.value : null,
      });
    });

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      document.body.classList.remove('landing-active');
    };
  }, []);

  const accessCopy = system.access?.available === false
    ? 'Voice preview used on this network'
    : '90-second voice preview';

  return (
    <div className="landing" ref={rootRef}>
      <div className="landing-noise" aria-hidden="true" />
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Voges home"><VogesMark /><span>Voges</span></a>
        <nav aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#safety">Safety</a>
          <a href="#stack">Stack</a>
        </nav>
        <a className="nav-launch" href="/app">Launch demo <ArrowRight size={15} /></a>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy-landing">
            <div className="hero-status reveal is-visible">
              <span className={system.online === false ? 'is-offline' : ''}><i /> {system.online === false ? 'SYSTEM CHECK' : 'LIVE SYSTEM'}</span>
              <span>VOICE-FIRST FINANCIAL CONCIERGE</span>
            </div>
            <h1 className="hero-title reveal is-visible">
              <span>Banking,</span>
              <span className="hero-title-shift">resolved out loud.</span>
            </h1>
            <div className="hero-lower reveal is-visible">
              <p>Voges investigates banking problems, proposes bounded actions, verifies the customer, and records the outcome—in one natural voice conversation.</p>
              <div className="hero-actions">
                <a className="landing-primary" href="/app">Experience Voges <ArrowRight size={18} /></a>
                <a className="landing-secondary" href="#product">See how it works <ArrowDown size={17} /></a>
              </div>
              <small>{accessCopy}. Sample banking data only. No real funds are moved.</small>
            </div>
          </div>
          <LiveArchitecture />
        </section>

        <section className="flow-marquee" aria-label="Voges workflow">
          <div>{[...FLOW, ...FLOW].map((item, index) => <span key={`${item}-${index}`}>{item}<i /></span>)}</div>
        </section>

        <section className="landing-intro" id="product">
          <div className="section-index reveal"><span>01</span><p>THE PRODUCT</p></div>
          <div className="intro-statement reveal">
            <span>Most banking assistants answer questions.</span>
            <h2>Voges resolves the problem.</h2>
          </div>
          <p className="intro-copy reveal">The model handles conversation. The backend owns truth, policy, approvals, execution, and evidence. That separation turns a voice interface into a controlled financial agent.</p>
        </section>

        <section className="capability-grid">
          {CAPABILITIES.map(({ index, title, copy, icon: Icon }) => (
            <article className="capability-card reveal" key={title}>
              <div><span>{index}</span><Icon size={20} /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <span className="capability-state"><i /> IMPLEMENTED</span>
            </article>
          ))}
        </section>

        <section className="resolution-section-landing">
          <div className="resolution-copy reveal">
            <span className="landing-kicker"><Sparkles size={15} /> SIGNATURE CAPABILITY</span>
            <h2>From root cause<br />to verified outcome.</h2>
            <p>Resolution Autopilot reads live D1 context, finds all relevant blockers, orders only allowlisted steps, asks for one bounded approval, and checks readiness again after execution.</p>
            <div className="resolution-principles">
              <span><BadgeCheck size={15} /> Structured plan contract</span>
              <span><BadgeCheck size={15} /> Dependency-aware execution</span>
              <span><BadgeCheck size={15} /> Before-and-after D1 evidence</span>
            </div>
          </div>
          <ResolutionDemo />
        </section>

        <section className="safety-section" id="safety">
          <div className="section-index reveal"><span>02</span><p>THE SAFETY LAYER</p></div>
          <div className="safety-head reveal">
            <h2>Voice is the interface.<br />The screen is the safety layer.</h2>
            <p>The LLM may propose intent. It never grants itself permission. Every sensitive change passes through deterministic controls outside the model.</p>
          </div>
          <div className="safety-pipeline reveal">
            {['AI proposal', 'Policy engine', 'On-screen approval', 'WebAuthn assertion', 'D1 execution', 'Audit receipt'].map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong>{index < 5 ? <ArrowRight size={16} /> : null}</div>
            ))}
          </div>
          <div className="safety-facts">
            <article className="reveal"><ShieldCheck size={24} /><h3>Deterministic policy</h3><p>Risk level, ownership, account status, payload schema, tool allowlist, and execution state are checked by backend code.</p></article>
            <article className="reveal"><Fingerprint size={24} /><h3>Real passkeys</h3><p>The browser and operating system perform local user verification. Voges receives a signed WebAuthn assertion—not fingerprint or face data.</p></article>
            <article className="reveal"><Database size={24} /><h3>Durable evidence</h3><p>Approved actions update D1, preserve before-and-after state, append audit events, and produce a privacy-safe verification receipt.</p></article>
          </div>
        </section>

        <section className="stack-section" id="stack">
          <div className="section-index reveal"><span>03</span><p>BUILT FOR THE EDGE</p></div>
          <div className="stack-layout">
            <div className="stack-title reveal"><h2>One conversation.<br />A verifiable chain.</h2></div>
            <div className="stack-list reveal">
              <div><span>INTELLIGENCE</span><strong>OpenAI GPT Realtime 2.1</strong></div>
              <div><span>VOICE TRANSPORT</span><strong>Browser WebRTC</strong></div>
              <div><span>BACKEND</span><strong>Cloudflare Pages Functions</strong></div>
              <div><span>DATABASE</span><strong>Cloudflare D1</strong></div>
              <div><span>AUTHENTICATION</span><strong>WebAuthn / Passkeys</strong></div>
              <div><span>CLIENT</span><strong>React, TypeScript, Vite</strong></div>
            </div>
          </div>
        </section>

        <section className="landing-cta reveal">
          <div className="cta-orb" aria-hidden="true"><VogesMark size={82} /></div>
          <span>THE CONVERSATION IS THE PRODUCT</span>
          <h2>Meet the financial concierge<br />that can explain its actions.</h2>
          <p>Explore the live portfolio prototype with sample banking data and a strictly limited voice preview.</p>
          <div>
            <a className="landing-primary" href="/app">Launch Voges <ArrowRight size={18} /></a>
            <a className="landing-secondary" href="https://github.com/dev-hkm/voges" target="_blank" rel="noreferrer">View source <Code2 size={17} /></a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-brand" href="#top"><VogesMark size={30} /><span>Voges</span></a>
        <p>Voice-first AI financial concierge. Portfolio prototype using sample banking data.</p>
        <div><a href="/app">Demo</a><a href="https://github.com/dev-hkm/voges" target="_blank" rel="noreferrer">GitHub</a><span>2026</span></div>
      </footer>
    </div>
  );
}
