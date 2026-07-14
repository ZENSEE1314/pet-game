import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-br from-secondary/60 via-background to-accent/10 px-4 py-10"
    >
      {children}
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
    </main>
  );
}
