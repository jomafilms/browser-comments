import type { Metadata } from 'next';
import { Bricolage_Grotesque, Schibsted_Grotesk, JetBrains_Mono } from 'next/font/google';
import Hero from './_landing/Hero';
import Showcase from './_landing/Showcase';
import Install from './_landing/Install';
import ForAgents from './_landing/ForAgents';
import Limitations from './_landing/Limitations';
import Closing from './_landing/Closing';

// Fonts are scoped to the landing tree via `variable` classes on the wrapper
// below — they only define CSS vars, so /admin and /c/* keep their own styling.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'Browser Comments — clients mark up the page, your agents fix it',
  description:
    'A dead-simple, open-source feedback widget. Testers annotate any web page; you get a ticket with the screenshot that pipes straight into your coding agents. Self-hosted, free, no tracking.',
};

export default function Home() {
  return (
    <main
      className={`${bricolage.variable} ${schibsted.variable} ${jetbrains.variable} min-h-screen overflow-x-clip bg-paper font-body text-ink antialiased`}
    >
      <Hero />
      <Showcase />
      <Install />
      <ForAgents />
      <Limitations />
      <Closing />
    </main>
  );
}
