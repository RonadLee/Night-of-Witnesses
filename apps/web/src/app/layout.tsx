import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/i18n';

export const metadata: Metadata = {
  title: 'Night of Witnesses',
  description: 'A social deduction game of sightings, silence, and the Private Room.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
