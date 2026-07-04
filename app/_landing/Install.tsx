import CopyBlock from './CopyBlock';
import VercelMark from './VercelMark';
import { DEPLOY_URL, WIDGET_SNIPPET } from './constants';

const STEPS = [
  {
    n: '01',
    title: 'Deploy your instance',
    body: 'One click clones the repo and spins up a free Neon Postgres. The schema builds itself on first load — no migrations to run.',
  },
  {
    n: '02',
    title: 'Create a client & project',
    body: 'Sign in at /admin (first visit creates your owner account), add a client, and grab the widget key from the project view.',
  },
  {
    n: '03',
    title: 'Paste one script tag',
    body: 'Drop the snippet at the end of your site’s <body>. A floating feedback button appears — testers can start marking things up.',
  },
];

export default function Install() {
  return (
    <section id="install" className="relative border-t border-line bg-paper-card px-6 py-24 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <span className="font-code text-xs uppercase tracking-[0.2em] text-brand">
            Install
          </span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Live in three steps.
          </h2>
        </div>

        {/* Steps */}
        <ol className="mb-16 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="relative">
              <div className="mb-4 font-display text-5xl font-semibold text-ink/12">{s.n}</div>
              <h3 className="mb-2 font-body text-lg font-semibold text-ink">{s.title}</h3>
              <p className="font-body text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>

        {/* Deploy + snippet, side by side */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-line bg-paper p-7">
            <div>
              <h3 className="font-body text-base font-semibold text-ink">Step 1 — Deploy Button</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
                Provisions the app and a Neon database, then asks only for a{' '}
                <code className="rounded bg-ink/8 px-1.5 py-0.5 font-code text-[12px]">
                  BETTER_AUTH_SECRET
                </code>{' '}
                (generate with <code className="font-code text-[12px]">openssl rand -base64 32</code>).
              </p>
            </div>
            <a
              href={DEPLOY_URL}
              className="mt-6 inline-flex w-fit items-center gap-2.5 rounded-lg bg-ink px-5 py-3 font-body text-sm font-semibold text-paper transition hover:bg-brand-deep"
            >
              <VercelMark />
              Deploy to Vercel
            </a>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-line bg-paper p-7">
            <div>
              <h3 className="font-body text-base font-semibold text-ink">Step 3 — The widget</h3>
              <p className="mt-2 mb-4 font-body text-sm leading-relaxed text-ink-soft">
                Copy your project’s key straight from the admin client view (one
                click), then paste this before <code className="font-code text-[12px]">&lt;/body&gt;</code>.
              </p>
            </div>
            <CopyBlock code={WIDGET_SNIPPET} label="index.html" />
          </div>
        </div>
      </div>
    </section>
  );
}
