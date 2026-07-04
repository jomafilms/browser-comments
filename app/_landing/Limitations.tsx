// Honest "what won't capture" section. The annotation image is reconstructed by
// html2canvas (a DOM re-render), not a pixel screenshot — so a few things don't
// come through. Better to say so up front than surprise someone. Kept short.

const LIMITS = [
  {
    q: 'Cross-origin images show up blank',
    a: 'Images served from another domain need CORS headers (Access-Control-Allow-Origin) or the capture can’t read their pixels. Same-origin images are fine.',
  },
  {
    q: 'Videos capture as an empty or black frame',
    a: '<video> elements usually render as a blank rectangle. Annotate around them and describe the moment in the comment.',
  },
  {
    q: 'Iframes & embedded widgets aren’t captured',
    a: 'Third-party embeds (maps, players, chat bubbles, cross-origin iframes) render empty. The rest of the page still captures normally.',
  },
  {
    q: 'Native browser UI doesn’t appear',
    a: 'Open <select> dropdowns, native date pickers, alert/confirm dialogs, and scrollbars are drawn by the OS, not the page — so they’re not in the shot.',
  },
  {
    q: 'Some exotic CSS renders differently',
    a: 'Certain filters, blend modes, or bleeding-edge properties may look slightly off. Layout, text, and colors are reliable.',
  },
];

export default function Limitations() {
  return (
    <section className="relative border-t border-line px-6 py-24 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <span className="font-code text-xs uppercase tracking-[0.2em] text-brand">
              Known limitations
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              What it won’t capture — and why.
            </h2>
            <p className="mt-5 max-w-sm font-body text-lg leading-relaxed text-ink-soft">
              The annotated image is a{' '}
              <span className="marker-underline">reconstruction</span> of the page
              built with html2canvas — a re-render of the DOM, not a pixel
              screenshot. That keeps it lightweight and dependency-free, but a few
              things don’t come through. No surprises:
            </p>
          </div>

          <dl className="divide-y divide-line border-y border-line">
            {LIMITS.map((l) => (
              <div key={l.q} className="grid gap-1 py-5 sm:grid-cols-[1fr_1.3fr] sm:gap-8">
                <dt className="font-body text-[15px] font-semibold text-ink">{l.q}</dt>
                <dd className="font-body text-[15px] leading-relaxed text-ink-soft">{l.a}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-10 max-w-2xl font-body text-sm text-ink-faint">
          Need pixel-perfect captures of cross-origin assets? Add permissive CORS
          headers on the asset host — the one-time setup is in the docs.
        </p>
      </div>
    </section>
  );
}
