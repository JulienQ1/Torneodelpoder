'use client';

/**
 * Live gallery of the React Bits components vendored into this repo.
 *
 * It exists so the catalogue can be browsed in the running app instead of by
 * reading source, and so `next build` actually compiles every vendored file.
 * Nothing else in the app links here — delete this route if it stops earning
 * its keep.
 */

import Link from 'next/link';
import { cn } from '@/shared/lib/cn';

import BlurText from '@/shared/components/reactbits/TextAnimations/BlurText';
import CountUp from '@/shared/components/reactbits/TextAnimations/CountUp';
import DecryptedText from '@/shared/components/reactbits/TextAnimations/DecryptedText';
import GradientText from '@/shared/components/reactbits/TextAnimations/GradientText';
import RotatingText from '@/shared/components/reactbits/TextAnimations/RotatingText';
import ShinyText from '@/shared/components/reactbits/TextAnimations/ShinyText';
import SplitText from '@/shared/components/reactbits/TextAnimations/SplitText';
import TextType from '@/shared/components/reactbits/TextAnimations/TextType';

import AnimatedContent from '@/shared/components/reactbits/Animations/AnimatedContent';
import ClickSpark from '@/shared/components/reactbits/Animations/ClickSpark';
import ElectricBorder from '@/shared/components/reactbits/Animations/ElectricBorder';
import FadeContent from '@/shared/components/reactbits/Animations/FadeContent';
import GlareHover from '@/shared/components/reactbits/Animations/GlareHover';
import Magnet from '@/shared/components/reactbits/Animations/Magnet';
import StarBorder from '@/shared/components/reactbits/Animations/StarBorder';

import AnimatedList from '@/shared/components/reactbits/Components/AnimatedList';
import CardSwap, { Card } from '@/shared/components/reactbits/Components/CardSwap';
import Counter from '@/shared/components/reactbits/Components/Counter';
import Dock from '@/shared/components/reactbits/Components/Dock';
import MagicBento from '@/shared/components/reactbits/Components/MagicBento';
import SpotlightCard from '@/shared/components/reactbits/Components/SpotlightCard';
import Stepper, { Step } from '@/shared/components/reactbits/Components/Stepper';
import TiltedCard from '@/shared/components/reactbits/Components/TiltedCard';

import Aurora from '@/shared/components/reactbits/Backgrounds/Aurora';
import DotGrid from '@/shared/components/reactbits/Backgrounds/DotGrid';
import Particles from '@/shared/components/reactbits/Backgrounds/Particles';
import Waves from '@/shared/components/reactbits/Backgrounds/Waves';

/** Brand purple scale, mirrored from tailwind.config.ts for effects that take raw colors. */
const BRAND = {
  400: '#a78bfa',
  500: '#8b5cf6',
  600: '#7c3aed',
  900: '#4c1d95',
} as const;

/** Inline artwork so the gallery needs no binary assets in /public. */
const PLACEHOLDER_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#ec4899"/>
       </linearGradient></defs>
       <rect width="320" height="320" rx="24" fill="url(#g)"/>
       <text x="160" y="185" font-size="110" text-anchor="middle">🏆</text>
     </svg>`,
  );

function Section({
  title,
  dir,
  children,
}: {
  title: string;
  dir: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3 border-b border-slate-800 pb-2">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <code className="text-xs text-slate-500">reactbits/{dir}/</code>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Demo({
  name,
  note,
  className,
  span,
  children,
}: {
  name: string;
  note: string;
  /** Extra classes for the preview area. */
  className?: string;
  /** Extra classes for the grid cell itself (column spans). */
  span?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40',
        span,
      )}
    >
      <div
        className={cn(
          'relative flex min-h-[10rem] flex-1 items-center justify-center overflow-hidden p-6',
          className,
        )}
      >
        {children}
      </div>
      <figcaption className="border-t border-slate-800 px-4 py-2">
        <div className="font-mono text-sm text-brand-300">{name}</div>
        <div className="text-xs text-slate-500">{note}</div>
      </figcaption>
    </figure>
  );
}

export default function UiGalleryPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <SplitText
          text="React Bits gallery"
          tag="h1"
          className="text-4xl font-bold text-slate-50"
          splitType="chars"
          delay={40}
        />
        <p className="max-w-2xl text-sm text-slate-400">
          The 27 components vendored into{' '}
          <code className="text-slate-300">src/shared/components/reactbits/</code>. Full catalogue
          at <span className="text-brand-400">reactbits.dev</span>; the wider design bank lives in{' '}
          <code className="text-slate-300">docs/UI-RESOURCES.md</code>.
        </p>
        <Link href="/" className="inline-block text-sm text-brand-400 hover:text-brand-300">
          ← back to the app
        </Link>
      </header>

      <Section title="Text animations" dir="TextAnimations">
        <Demo name="SplitText" note="gsap · per-char reveal on scroll into view">
          <SplitText text="Sudden Death" className="text-2xl font-bold" splitType="chars" />
        </Demo>

        <Demo name="BlurText" note="motion · word-by-word blur in">
          <BlurText text="Crown one song" className="text-2xl font-bold" animateBy="words" />
        </Demo>

        <Demo name="ShinyText" note="motion · sweeping highlight">
          <ShinyText text="Torneo del Poder" className="text-2xl font-bold" speed={3} />
        </Demo>

        <Demo name="GradientText" note="motion · animated gradient fill">
          <GradientText
            className="text-2xl font-bold"
            colors={[BRAND[400], '#ec4899', BRAND[400]]}
          >
            Champion
          </GradientText>
        </Demo>

        <Demo name="CountUp" note="motion · number ticks up when visible">
          <span className="text-4xl font-bold text-slate-100">
            <CountUp to={64} duration={2} /> <span className="text-base font-normal">songs</span>
          </span>
        </Demo>

        <Demo name="RotatingText" note="motion · cycles through a list">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <span>Vote for the</span>
            <RotatingText
              texts={['loudest', 'catchiest', 'weirdest']}
              mainClassName="rounded-lg bg-brand-600 px-2 py-1 text-slate-50"
              rotationInterval={2200}
            />
          </div>
        </Demo>

        <Demo name="DecryptedText" note="motion · scramble-to-reveal (hover)">
          <DecryptedText
            text="ROUND OF 16"
            className="text-2xl font-bold text-slate-100"
            encryptedClassName="text-2xl font-bold text-brand-500"
            animateOn="hover"
          />
        </Demo>

        <Demo name="TextType" note="gsap · typewriter with cursor">
          <TextType
            text={['Importing playlist…', 'Seeding the bracket…', 'Ready.']}
            className="text-xl font-medium text-slate-100"
            typingSpeed={55}
          />
        </Demo>
      </Section>

      <Section title="Animations" dir="Animations">
        <Demo name="AnimatedContent" note="gsap · slide + fade wrapper on scroll">
          <AnimatedContent distance={60} duration={0.9}>
            <div className="rounded-xl bg-slate-800 px-5 py-3 text-slate-200">Match 3 of 8</div>
          </AnimatedContent>
        </Demo>

        <Demo name="FadeContent" note="gsap · blur-fade wrapper on scroll">
          <FadeContent blur duration={900}>
            <div className="rounded-xl bg-slate-800 px-5 py-3 text-slate-200">Winner locked in</div>
          </FadeContent>
        </Demo>

        <Demo name="ClickSpark" note="canvas · sparks on click, no deps" className="p-0">
          <ClickSpark sparkColor={BRAND[400]} sparkCount={10} sparkRadius={22}>
            <div className="flex h-40 w-full items-center justify-center text-sm text-slate-400">
              click anywhere in this box
            </div>
          </ClickSpark>
        </Demo>

        <Demo name="StarBorder" note="css · orbiting glow border">
          <StarBorder color={BRAND[400]} speed="4s">
            Join room
          </StarBorder>
        </Demo>

        <Demo name="ElectricBorder" note="svg filter · crackling outline">
          <ElectricBorder color={BRAND[400]} speed={1} chaos={0.35} borderRadius={16}>
            <div className="w-40 px-6 py-5 text-center text-slate-200">Tie-break</div>
          </ElectricBorder>
        </Demo>

        <Demo name="GlareHover" note="css · light sweep on hover">
          <GlareHover
            width="14rem"
            height="7rem"
            background="#1e293b"
            borderColor="#334155"
            borderRadius="0.75rem"
            glareColor="#ffffff"
            glareOpacity={0.25}
          >
            <span className="text-slate-200">hover me</span>
          </GlareHover>
        </Demo>

        <Demo name="Magnet" note="pointer · element leans toward the cursor">
          <Magnet padding={80} magnetStrength={3}>
            <div className="rounded-full bg-brand-600 px-6 py-3 font-medium text-white">Vote</div>
          </Magnet>
        </Demo>
      </Section>

      <Section title="Components" dir="Components">
        <Demo name="SpotlightCard" note="css · cursor-tracking spotlight">
          <SpotlightCard
            className="w-full bg-slate-900"
            spotlightColor="rgba(139, 92, 246, 0.25)"
          >
            <div className="text-slate-200">
              <div className="font-semibold">Room QX7P</div>
              <div className="text-sm text-slate-400">8 players · 32 songs</div>
            </div>
          </SpotlightCard>
        </Demo>

        <Demo
          name="AnimatedList"
          note="motion · staggered, keyboard-navigable list"
          className="min-h-[17rem] items-start"
        >
          <AnimatedList
            items={['Daft Punk', 'Justice', 'Kavinsky', 'Gesaffelstein']}
            className="w-full"
            showGradients={false}
            enableArrowNavigation={false}
          />
        </Demo>

        <Demo name="Counter" note="motion · odometer-style digits">
          <Counter value={128} fontSize={44} textColor="#e2e8f0" gradientFrom="#0f172a" />
        </Demo>

        <Demo name="Dock" note="motion · magnifying macOS-style dock" className="items-end pb-2">
          <Dock
            items={[
              { icon: '🏠', label: 'Home', onClick: () => {} },
              { icon: '🎵', label: 'Songs', onClick: () => {} },
              { icon: '🏆', label: 'Bracket', onClick: () => {} },
              { icon: '⚙️', label: 'Settings', onClick: () => {} },
            ]}
          />
        </Demo>

        <Demo name="TiltedCard" note="motion · 3D tilt following the pointer">
          <TiltedCard
            imageSrc={PLACEHOLDER_COVER}
            altText="Album cover"
            captionText="Now playing"
            containerHeight="10rem"
            containerWidth="10rem"
            imageHeight="10rem"
            imageWidth="10rem"
          />
        </Demo>

        <Demo
          name="Stepper"
          note="motion · multi-step flow (Stepper + Step)"
          span="sm:col-span-2"
        >
          <Stepper
            initialStep={1}
            stepCircleContainerClassName="bg-slate-900 border border-slate-800"
            backButtonText="Back"
            nextButtonText="Next"
          >
            <Step>
              <p className="text-slate-200">Import your songs.</p>
            </Step>
            <Step>
              <p className="text-slate-200">Invite the room.</p>
            </Step>
            <Step>
              <p className="text-slate-200">Start the tournament.</p>
            </Step>
          </Stepper>
        </Demo>

        <Demo
          name="CardSwap"
          note="gsap · 3D card carousel (needs a relative parent)"
          className="min-h-[17rem]"
          span="sm:col-span-2"
        >
          <div className="relative h-full w-full">
            <CardSwap width={220} height={140} cardDistance={44} verticalDistance={52} delay={3200}>
              <Card customClass="grid place-items-center bg-slate-900 text-slate-200">
                Quarter-final
              </Card>
              <Card customClass="grid place-items-center bg-slate-900 text-slate-200">
                Semi-final
              </Card>
              <Card customClass="grid place-items-center bg-slate-900 text-slate-200">Final</Card>
            </CardSwap>
          </div>
        </Demo>

        <Demo
          name="MagicBento"
          note="gsap · full bento grid with spotlight, tilt & particles"
          className="overflow-x-auto"
          span="sm:col-span-2 xl:col-span-3"
        >
          <MagicBento glowColor="139, 92, 246" particleCount={8} enableTilt={false} />
        </Demo>
      </Section>

      <Section title="Backgrounds" dir="Backgrounds">
        <Demo name="Aurora" note="ogl/WebGL · drifting aurora ribbon" className="p-0">
          <div className="relative h-48 w-full">
            <Aurora colorStops={[BRAND[600], '#ec4899', BRAND[400]]} amplitude={1} blend={0.5} />
          </div>
        </Demo>

        <Demo name="Particles" note="ogl/WebGL · floating particle field" className="p-0">
          <div className="relative h-48 w-full">
            <Particles particleCount={160} particleColors={[BRAND[400], '#ec4899']} />
          </div>
        </Demo>

        <Demo name="DotGrid" note="gsap · dot grid reacting to the cursor" className="p-0">
          <div className="relative h-48 w-full">
            <DotGrid dotSize={4} gap={18} baseColor="#334155" activeColor={BRAND[400]} />
          </div>
        </Demo>

        <Demo name="Waves" note="canvas · perlin wave lines, no deps" className="p-0">
          <div className="relative h-48 w-full">
            <Waves lineColor="#475569" backgroundColor="transparent" />
          </div>
        </Demo>
      </Section>

      <footer className="border-t border-slate-800 pt-6 text-xs text-slate-500">
        React Bits by David Haz — MIT + Commons Clause. Vendored, not bundled: edit the files in{' '}
        <code>src/shared/components/reactbits/</code> freely.
      </footer>
    </main>
  );
}
