import Link from 'next/link';
import { PawPrint, Gamepad2, Gift, Target, Trophy, ScanLine, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PetMascot } from '@/components/pet/PetMascot';

const FEATURES = [
  {
    icon: PawPrint,
    title: 'Adopt & care',
    body: 'Feed, bathe, play, rest and heal. Your pet grows through five stages — and remembers how you treated it.',
  },
  {
    icon: Gamepad2,
    title: 'Two mini games',
    body: 'Endless Runner and Feeding Catch. Every score is verified server-side before a single coin is paid.',
  },
  {
    icon: Target,
    title: 'Daily & weekly missions',
    body: 'Clear objectives, real rewards, and a login streak that pays out reward points every seventh day.',
  },
  {
    icon: Trophy,
    title: 'Leaderboards',
    body: 'Daily, weekly, monthly and all-time. Only validated scores get on the board.',
  },
  {
    icon: Gift,
    title: 'Redeem for real rewards',
    body: 'Turn reward points into vouchers, food, drinks, merch and event tickets.',
  },
  {
    icon: ScanLine,
    title: 'Collect with a QR code',
    body: 'Show your signed claim code in store. Staff scan it once — and only once.',
  },
];

const JOURNEY = [
  'Register',
  'Create profile',
  'Adopt a pet',
  'Complete pet care',
  'Play mini games',
  'Earn coins & points',
  'Complete missions',
  'Level up',
  'Redeem rewards',
];

export default function LandingPage() {
  return (
    <main id="main" className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="pq-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white">
            <PawPrint className="h-5 w-5" aria-hidden />
          </div>
          <span className="text-lg font-extrabold tracking-tight">PetQuest Rewards</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="gradient" size="sm">
            <Link href="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
            Adopt · Play · Earn · Redeem
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Your pet.
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Your rewards.
            </span>
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Raise a virtual companion, win mini games, complete missions — and turn your reward
            points into things you can actually hold.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="gradient">
              <Link href="/register">
                Adopt your pet
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I already play</Link>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-sm">
          <div className="pq-gradient absolute inset-6 rounded-full opacity-20 blur-3xl" aria-hidden />
          <PetMascot stage="ADULT" mood={95} className="relative" />
        </div>
      </section>

      <section className="border-y bg-secondary/40 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            Everything in one loop
          </h2>
          <ol className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {JOURNEY.map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span className="rounded-full border bg-background px-3 py-1.5 text-sm font-semibold">
                  {step}
                </span>
                {index < JOURNEY.length - 1 ? (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="transition-transform hover:-translate-y-1">
              <CardContent className="space-y-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-bold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="pq-gradient flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight">Ready to meet your pet?</h2>
          <p className="max-w-md text-white/90">
            It takes thirty seconds to sign up, and your first pet is free.
          </p>
          <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
            <Link href="/register">Start playing</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} PetQuest Rewards</p>
          <nav className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
