import CopyBlock from './CopyBlock';
import { CLI_INSTALL, CLI_WATCH, WEBHOOK_REGISTER, LLMS_BLOCK } from './constants';

export default function ForAgents() {
  return (
    <section id="agents" className="relative border-t border-line px-6 py-24 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <span className="font-code text-xs uppercase tracking-[0.2em] text-brand">
            For coding agents
          </span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Feedback that pipes into your agents.
          </h2>
          <p className="mt-4 font-body text-lg leading-relaxed text-ink-soft">
            It’s plumbing, not a bot: Browser Comments emits webhooks and answers
            polls. Wire tickets into a Claude Code Routine, a GitHub Action, or a
            watch loop — you stay in control of what the agent does.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-paper-card p-6">
            <h3 className="mb-1 font-body text-base font-semibold text-ink">Push — webhooks</h3>
            <p className="mb-4 font-body text-sm text-ink-soft">
              Instant delivery, HMAC-signed. Register one and verify{' '}
              <code className="font-code text-[12px]">X-BC-Signature</code> before trusting it.
            </p>
            <CopyBlock code={WEBHOOK_REGISTER} label="register a webhook" />
          </div>

          <div className="rounded-xl border border-line bg-paper-card p-6">
            <h3 className="mb-1 font-body text-base font-semibold text-ink">Pull — the CLI watch loop</h3>
            <p className="mb-4 font-body text-sm text-ink-soft">
              No receiver needed. Streams new/changed tickets as JSON, exactly once
              across restarts.
            </p>
            <CopyBlock code={`${CLI_INSTALL}\n\n${CLI_WATCH}`} label="terminal" />
          </div>
        </div>

        {/* llms.txt block for agents pasted this page */}
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-body text-base font-semibold text-ink">
              Paste-to-configure block
            </h3>
            <span className="rounded-full border border-line bg-paper-card px-2.5 py-0.5 font-code text-[10px] uppercase tracking-wider text-ink-faint">
              llms.txt
            </span>
          </div>
          <p className="mb-4 max-w-2xl font-body text-sm text-ink-soft">
            Hand this to a coding agent and it has everything to self-configure —
            endpoints, auth, and the read/update contract.
          </p>
          <CopyBlock code={LLMS_BLOCK} label="/llms.txt" />
        </div>
      </div>
    </section>
  );
}
