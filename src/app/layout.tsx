import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'PetQuest Rewards — Adopt. Play. Earn. Redeem.',
    template: '%s · PetQuest Rewards',
  },
  description:
    'Adopt a virtual pet, play mini games, complete missions and turn your reward points into real prizes.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'PetQuest',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/assets/icon.svg',
    apple: '/assets/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8b5cf6' },
    { media: '(prefers-color-scheme: dark)', color: '#1e1b4b' },
  ],
  width: 'device-width',
  initialScale: 1,
  // The game canvases need a stable viewport; a pinch-zoom mid-run is a lost run.
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
