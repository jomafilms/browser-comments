import Link from 'next/link';
import WidgetDemo from './WidgetDemo';
import VercelMark from './VercelMark';
import { DEPLOY_URL, GITHUB_URL } from './constants';

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-8 sm:px-10">
      {/* Nav */}
      <nav className="mx-auto mb-16 flex max-w-6xl items-center justify-between">
        <span className="font-display text-xl font-bold tracking-tight text-ink">
          dev<span className="text-brand">·</span>tix
        </span>
        <div className="flex items-center gap-6 font-body text-sm text-ink-soft">
          <a href="#install" className="hidden transition hover:text-ink sm:inline">
            Install
          </a>
          <a href="#agents" className="hidden transition hover:text-ink sm:inline">
            For agents
          </a>
          <a href="/admin" className="hidden transition hover:text-ink sm:inline">
            Sign in
          </a>
          <a
            href={GITHUB_URL}
            className="rounded-full border border-ink/15 px-4 py-1.5 transition hover:border-ink hover:bg-ink hover:text-paper"
          >
            GitHub
          </a>
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
        {/* Left: copy */}
        <div className="bc-rise">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-paper-card px-3.5 py-1.5 font-code text-[11px] uppercase tracking-[0.15em] text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Open source · self-hosted · free
          </span>

          <h1 className="font-display text-[2.9rem] font-bold leading-[1.02] tracking-[-0.025em] text-ink sm:text-6xl">
            Your clients{' '}
            <span className="marker-underline">mark up</span> the page.
            <br />
            You and your agents{' '}
            <span className="relative whitespace-nowrap text-brand">
              fix it.
            </span>
          </h1>

          <p className="mt-6 max-w-md font-body text-lg leading-relaxed text-ink-soft">
            A dead-simple feedback widget testers drop onto any site. They circle
            what&apos;s wrong, you get a ticket with the screenshot — and it feeds
            straight to your coding agents over webhooks or a poll.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href={DEPLOY_URL}
              className="group inline-flex items-center gap-2.5 rounded-lg bg-brand px-5 py-3 font-body text-sm font-semibold text-white transition hover:bg-brand-deep"
            >
              <VercelMark />
              Deploy your own in one click
            </a>
            <Link
              href="#install"
              className="font-body text-sm font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4 transition hover:text-brand"
            >
              or install in 3 steps ↓
            </Link>
          </div>

          <p className="mt-5 font-code text-xs text-ink-faint">
            Provisions a free Neon Postgres. No signup, no analytics, no cookie banner.
          </p>
        </div>

        {/* Right: live mock */}
        <div className="bc-rise pl-2 pr-6 sm:pr-2" style={{ animationDelay: '0.15s' }}>
          <WidgetDemo />
        </div>
      </div>
    </section>
  );
}
