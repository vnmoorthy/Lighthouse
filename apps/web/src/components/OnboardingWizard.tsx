/**
 * First-run onboarding wizard.
 *
 * Shows when the user has no receipts and hasn't dismissed it. Three steps:
 *   1. What is this — privacy & how it works
 *   2. Connect Gmail — pointer to the CLI command (we can't run setup
 *      from the dashboard since it needs a TTY).
 *   3. First sync — explain the cost / time / what to expect
 *
 * Dismissed state persists in localStorage so re-visiting the dashboard
 * after the seed runs doesn't re-show this.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type SummaryResponse } from '../lib/api';
import { ShieldCheck, ChevronRight, Terminal, Sparkles, X } from 'lucide-react';

const STORAGE = 'lh_onboarding_dismissed';

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE) === '1') setDismissed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const summary = useQuery({
    queryKey: ['summary-onboarding'],
    queryFn: () => api<SummaryResponse>('/api/summary'),
  });
  const totalEmails = summary.data
    ? Object.values(summary.data.email_processing).reduce((a, b) => a + b, 0)
    : null;

  // Show only when totalEmails is loaded and == 0 and not dismissed.
  if (dismissed || totalEmails === null || totalEmails > 0) return null;

  function close() {
    try {
      localStorage.setItem(STORAGE, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-xl lh-card-elev animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-lh-line/60">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-lh-coral" strokeWidth={1.75} />
            <span className="text-sm font-medium">Welcome to Lighthouse</span>
            <span className="text-2xs text-lh-mute">step {step + 1} of 3</span>
          </div>
          <button type="button" className="lh-btn-icon" onClick={close} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="p-6">
          {step === 0 ? <Intro /> : step === 1 ? <Connect /> : <FirstSync />}
        </div>
        <div className="border-t border-lh-line/60 px-6 py-3 flex items-center justify-between">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === step ? 'bg-lh-coral' : 'bg-lh-line2'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <button type="button" className="lh-btn !py-1.5" onClick={() => setStep(step - 1)}>
                Back
              </button>
            ) : null}
            {step < 2 ? (
              <button
                type="button"
                className="lh-btn-primary !py-1.5"
                onClick={() => setStep(step + 1)}
              >
                Next <ChevronRight size={13} />
              </button>
            ) : (
              <button type="button" className="lh-btn-primary !py-1.5" onClick={close}>
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Intro() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-snug text-lh-fore">
        Your inbox, your money, your machine.
      </h2>
      <p className="text-sm text-lh-mute leading-relaxed">
        Lighthouse reads your Gmail (read-only) and uses an LLM to extract every
        receipt, subscription, and trial into a local SQLite database. Nothing
        leaves your computer except the API calls you authorize.
      </p>
      <div className="grid grid-cols-3 gap-3 mt-2">
        <Pillar icon={<ShieldCheck size={14} />} title="Local only" body="No cloud, no servers, no telemetry." />
        <Pillar icon={<Sparkles size={14} />} title="LLM-powered" body="Structured extraction. No regex piles." />
        <Pillar icon={<Terminal size={14} />} title="MIT" body="Read every line; fork without ceremony." />
      </div>
    </div>
  );
}

function Connect() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-snug text-lh-fore">
        Connect Gmail
      </h2>
      <p className="text-sm text-lh-mute leading-relaxed">
        OAuth happens in the terminal so the encrypted refresh token never
        passes through the browser. From your Lighthouse repo:
      </p>
      <pre className="lh-card p-3 text-xs font-mono leading-relaxed text-lh-fore overflow-x-auto">
{`# 1. Get OAuth credentials at console.cloud.google.com
cp .env.example .env  # fill in GOOGLE_CLIENT_ID/SECRET + your LLM key

# 2. Pick a passphrase, do the OAuth dance.
npm run setup`}
      </pre>
      <div className="text-2xs text-lh-mute">
        The passphrase you choose encrypts the Gmail refresh token at rest with
        argon2id+AES-GCM. Lighthouse can't read your token without it.
      </div>
    </div>
  );
}

function FirstSync() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-snug text-lh-fore">
        Run your first sync
      </h2>
      <p className="text-sm text-lh-mute leading-relaxed">
        The first sync fetches the last 24 months of mail and runs each email
        through the LLM. It takes about 90 minutes for a typical inbox and
        costs roughly $50 in cloud-LLM credit. Switch to local Ollama for $0.
      </p>
      <pre className="lh-card p-3 text-xs font-mono leading-relaxed text-lh-fore overflow-x-auto">
{`npm run sync
# ...90 minutes later...
npm run serve            # → http://localhost:5174`}
      </pre>
      <p className="text-2xs text-lh-mute leading-relaxed">
        Re-syncing is essentially free — every classification is content-hash
        cached. Want to try the dashboard before you sync?{' '}
        <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">npm run seed:demo</code>{' '}
        populates 200 fake receipts.
      </p>
    </div>
  );
}

function Pillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="lh-card p-3">
      <div className="text-lh-coral mb-1.5">{icon}</div>
      <div className="text-xs font-medium text-lh-fore">{title}</div>
      <div className="text-2xs text-lh-mute mt-0.5 leading-relaxed">{body}</div>
    </div>
  );
}
