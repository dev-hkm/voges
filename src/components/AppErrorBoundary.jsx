import { Component } from 'react';
import { RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';

function recoveryReference() {
  const randomPart = crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `VGS-${randomPart.toUpperCase()}`;
}

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, reference: '' };
  }

  static getDerivedStateFromError(error) {
    return { error, reference: recoveryReference() };
  }

  componentDidCatch(error) {
    // Never log component state or banking data. The error name and a local
    // reference are enough to correlate a display failure during development.
    console.error('Voges display recovery triggered:', error?.name || 'unknown_error');
  }

  resetView = () => {
    this.setState({ error: null, reference: '' });
  };

  reloadApp = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="recovery-shell">
        <section className="recovery-card" role="alert" aria-live="assertive">
          <span className="recovery-icon"><ShieldAlert size={24} /></span>
          <span className="eyebrow">Protected recovery</span>
          <h1>Voges stopped a display error.</h1>
          <p>
            The interface encountered a problem and was isolated before it could
            affect the rest of the experience. No banking action was approved by
            this screen.
          </p>
          <div className="recovery-reference">
            <span>Reference</span>
            <strong>{this.state.reference}</strong>
          </div>
          <div className="recovery-actions">
            <button className="secondary-action" type="button" onClick={this.resetView}>
              <RotateCcw size={16} />
              Try the interface again
            </button>
            <button className="primary-action" type="button" onClick={this.reloadApp}>
              <RefreshCw size={16} />
              Reload Voges
            </button>
          </div>
        </section>
      </main>
    );
  }
}
