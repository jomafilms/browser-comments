import Image from 'next/image';

// A real capture of the annotation modal in action (from /test-widget, fake
// content). Regenerate with the flow documented in the lane, output to
// public/demo/annotation-demo.png.
export default function Showcase() {
  return (
    <section className="relative border-t border-line bg-ink px-6 py-24 text-paper sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <span className="font-code text-xs uppercase tracking-[0.2em] text-highlight">
              See it work
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Draw on the page. That’s the whole tool.
            </h2>
            <p className="mt-4 font-body text-lg leading-relaxed text-paper/70">
              Testers hit the feedback button, the current screen is captured, and
              they mark it up — pen, arrows, boxes, text notes. This is the real
              modal, unedited.
            </p>
          </div>
          <ul className="flex shrink-0 flex-col gap-2 font-code text-xs uppercase tracking-wider text-paper/50">
            <li>› pen · arrow · box · text</li>
            <li>› auto screen capture</li>
            <li>› one-click submit</li>
          </ul>
        </div>

        <figure className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-slate shadow-2xl">
          <Image
            src="/demo/annotation-demo.png"
            alt="The Browser Comments feedback modal: a captured page with an orange box and arrow drawn around a section and a handwritten note reading ‘spacing feels tight here — can we add padding?’"
            width={900}
            height={900}
            className="h-auto w-full"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </figure>
        <figcaption className="mx-auto mt-3 max-w-3xl font-code text-xs text-paper/40">
          Real capture from the widget’s test harness — example content, not a real client.
        </figcaption>
      </div>
    </section>
  );
}
