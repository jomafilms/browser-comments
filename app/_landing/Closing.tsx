import { DEPLOY_URL, GITHUB_URL } from './constants';

const POINTS = [
  {
    k: 'Free & open source',
    v: 'Self-host it, fork it, read every line. The free tier is the whole product — no seat limits, no upsell wall.',
  },
  {
    k: 'Cheap to run',
    v: 'A Vercel hobby project and a free Neon database. Most small teams pay nothing to run it.',
  },
  {
    k: 'Built for tiny teams',
    v: 'One owner login, per-client keys, no org chart. Scales up fine — but it doesn’t make you set that up first.',
  },
  {
    k: 'No tracking',
    v: 'No analytics, no third-party scripts, no cookie banner. The widget only phones home to your instance.',
  },
];

export default function Closing() {
  return (
    <section className="relative border-t border-line bg-paper-card px-6 py-24 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <span className="font-code text-xs uppercase tracking-[0.2em] text-brand">
              Honest pricing
            </span>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              The cheapest way to turn feedback into fixes.
            </h2>
            <p className="mt-5 max-w-md font-body text-lg leading-relaxed text-ink-soft">
              Browser Comments is MIT-style open source and self-hosted. A paid,
              honor-system commercial tier may come later — but nothing here is
              gated, metered, or waiting for a credit card.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={DEPLOY_URL}
                className="inline-flex items-center gap-2.5 rounded-lg bg-ink px-5 py-3 font-body text-sm font-semibold text-paper transition hover:bg-brand-deep"
              >
                Deploy your own
              </a>
              <a
                href={GITHUB_URL}
                className="inline-flex items-center gap-2 rounded-lg border border-ink/20 px-5 py-3 font-body text-sm font-semibold text-ink transition hover:border-ink hover:bg-ink hover:text-paper"
              >
                Read the source ↗
              </a>
            </div>
          </div>

          <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {POINTS.map((p) => (
              <div key={p.k} className="bg-paper p-6">
                <dt className="mb-2 flex items-center gap-2 font-body text-sm font-semibold text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {p.k}
                </dt>
                <dd className="font-body text-[14px] leading-relaxed text-ink-soft">{p.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="mt-24 flex flex-col items-start justify-between gap-4 border-t border-line pt-8 sm:flex-row sm:items-center">
          <span className="font-display text-lg font-bold text-ink">
            dev<span className="text-brand">·</span>tix
          </span>
          <div className="flex items-center gap-6 font-body text-sm text-ink-soft">
            <a href={GITHUB_URL} className="transition hover:text-ink">
              GitHub
            </a>
            <a href={`${GITHUB_URL}/blob/main/RELEASE-NOTES.md`} className="transition hover:text-ink">
              Release notes
            </a>
            <a href={`${GITHUB_URL}/blob/main/docs/AGENT-SETUP.md`} className="transition hover:text-ink">
              Agent setup
            </a>
            <a href="/admin" className="transition hover:text-ink">
              Owner login
            </a>
          </div>
        </footer>
      </div>
    </section>
  );
}
