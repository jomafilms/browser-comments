/**
 * Inline mock of the feedback widget in action — a browser window with a client
 * marking up the page (marker circle + arrow) and a feedback note being filed.
 * Pure CSS/SVG so it renders instantly with no image asset to host or go stale.
 * Swap in a real screenshot/GIF of the live widget flow later if desired.
 */

// Length of the hand-drawn circle path; drives both the dash array and the
// draw-on animation's start offset, so keep them equal.
const CIRCLE_DASH = '620';

export default function WidgetDemo() {
  return (
    <div className="relative select-none">
      {/* Browser window */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_30px_60px_-20px_rgba(23,20,13,0.35)]">
        {/* Chrome */}
        <div className="flex items-center gap-2 border-b border-line bg-paper-card px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
          <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 font-code text-[11px] text-ink-faint">
            app.yourclient.com/pricing
          </div>
        </div>

        {/* Fake page under review */}
        <div className="relative bg-white px-7 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-3 w-20 rounded bg-ink/10" />
            <div className="flex gap-3">
              <div className="h-2.5 w-10 rounded bg-ink/10" />
              <div className="h-2.5 w-10 rounded bg-ink/10" />
              <div className="h-2.5 w-10 rounded bg-ink/10" />
            </div>
          </div>
          <div className="mb-2 h-5 w-2/3 rounded bg-ink/15" />
          <div className="mb-1.5 h-2.5 w-full rounded bg-ink/8" />
          <div className="mb-6 h-2.5 w-4/5 rounded bg-ink/8" />

          {/* The circled-and-annotated element */}
          <div className="relative inline-block">
            <div className="rounded-md bg-brand px-5 py-2.5 font-body text-sm font-semibold text-white">
              Get started — it&apos;s free
            </div>
            {/* Hand-drawn marker circle */}
            <svg
              className="pointer-events-none absolute -left-6 -top-4 h-[90px] w-[260px]"
              viewBox="0 0 260 90"
              fill="none"
            >
              <path
                className="bc-draw"
                style={{ ['--dash' as string]: CIRCLE_DASH, animation: 'bc-draw 1.4s ease-out 0.5s both' }}
                strokeDasharray={CIRCLE_DASH}
                d="M40 44 C 30 18, 120 8, 190 14 C 245 20, 250 62, 205 74 C 150 88, 45 86, 26 60 C 16 44, 30 30, 60 26"
                stroke="var(--color-marker)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Floating feedback note the client is writing */}
      <div className="absolute -bottom-8 -right-4 w-64 rotate-[2deg] rounded-lg border border-line bg-paper-card p-4 shadow-[0_20px_40px_-16px_rgba(23,20,13,0.4)] sm:-right-10">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[10px] font-bold text-paper-card">
            JL
          </span>
          <span className="font-body text-xs font-semibold text-ink">Jamie · client</span>
        </div>
        <p className="font-body text-[13px] leading-snug text-ink-soft">
          this button overflows on mobile and the copy should say{' '}
          <span className="marker-underline text-ink">&ldquo;Start free&rdquo;</span>
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-code text-[10px] uppercase tracking-wider text-ink-faint">
            → ticket LWF-12
          </span>
          <span className="rounded bg-marker px-2 py-0.5 font-code text-[10px] font-semibold text-white">
            open
          </span>
        </div>
      </div>

      {/* The widget launcher button */}
      <div className="absolute -bottom-6 left-6 flex items-center gap-2">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 20l3.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
