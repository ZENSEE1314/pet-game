import Link from 'next/link';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Development placeholder — replace with a counsel-reviewed policy before launch.
      </p>

      <div className="mt-8 space-y-6">
        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Account data: email, username, display name, optional phone and country.</li>
            <li>Gameplay data: pet stats, care actions, game sessions, scores, missions.</li>
            <li>Economy data: every currency transaction, with a reason and a timestamp.</li>
            <li>
              Security data: IP address and user agent at sign-up, sign-in, game submission and QR
              scan. We use these to detect reward farming.
            </li>
          </ul>
        </Section>

        <Section title="Why we collect it">
          <p>
            To run the game, to pay out rewards correctly, and to detect abuse. Because Reward Points
            convert into things of real value, we keep a complete, immutable record of every balance
            change — this protects you as much as us.
          </p>
        </Section>

        <Section title="What we don't do">
          <p>
            We do not sell your data. We do not share it with advertisers. Passwords are stored only
            as a bcrypt hash and are never recoverable, by us or by anyone else.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can view your full transaction history in the app at any time, edit your profile, and
            request account deletion by contacting support. Deleting an account removes your personal
            data; anonymised ledger records are retained for accounting integrity.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
