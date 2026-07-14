import Link from 'next/link';

export const metadata = { title: 'Terms & Conditions' };

export default function TermsPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Terms &amp; Conditions</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Development placeholder — replace with counsel-reviewed terms before launch.
      </p>

      <div className="prose prose-slate mt-8 max-w-none space-y-6 dark:prose-invert">
        <Section title="1. Your account">
          <p>
            You must provide accurate information and keep your password secure. One account per
            person. Accounts found to be operating in coordination to farm rewards may be suspended.
          </p>
        </Section>

        <Section title="2. Virtual currencies">
          <p>
            Coins, Gems and Reward Points have no cash value, cannot be sold or transferred between
            players, and cannot be withdrawn as money. Gems cannot be converted into Reward Points.
          </p>
          <p>
            Reward Points are subject to daily and monthly earning limits. We may adjust balances to
            correct errors, and every adjustment is recorded with a reason.
          </p>
        </Section>

        <Section title="3. Rewards & redemption">
          <p>
            Rewards are subject to availability. Redeeming a reward reserves stock and debits your
            Reward Points immediately. Claims expire after the period shown on the claim; expired
            claims are not refunded, though we may make exceptions at our discretion.
          </p>
          <p>
            Claim codes are single-use and non-transferable. We may require identification at
            collection.
          </p>
        </Section>

        <Section title="4. Fair play">
          <p>
            Automating gameplay, modifying the client, submitting fabricated scores, or exploiting a
            bug for gain will result in adjustment of your balances and may result in suspension.
            Suspicious activity is reviewed by a person, not an algorithm.
          </p>
        </Section>

        <Section title="5. Changes">
          <p>
            We may change these terms, the reward catalogue, and the earning rates. Material changes
            will be announced in the app.
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
