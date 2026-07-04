'use client';

import { useState } from 'react';
import { copyToClipboard } from '../../lib/clipboard';

/**
 * A code block with a one-click copy button. Used for every copy-paste snippet
 * on the landing page (widget tag, CLI, webhooks, llms.txt) and mirrors the
 * affordance in the admin client view so the two feel like one product.
 */
export default function CopyBlock({
  code,
  label,
  className = '',
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyToClipboard(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className={`group relative overflow-hidden rounded-lg bg-slate text-paper-card ${className}`}>
      {label && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="font-code text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            {label}
          </span>
        </div>
      )}
      <button
        onClick={copy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
        className="absolute right-3 top-3 z-10 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 font-code text-[11px] uppercase tracking-wider text-paper-card/80 transition hover:border-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span aria-live="polite">{copied ? '✓ copied' : 'copy'}</span>
      </button>
      <pre className="overflow-x-auto px-4 py-4 pr-20 font-code text-[13px] leading-relaxed text-paper-card/95">
        <code>{code}</code>
      </pre>
    </div>
  );
}
