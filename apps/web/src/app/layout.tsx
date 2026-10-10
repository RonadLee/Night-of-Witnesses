import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Night of Witnesses',
  description: 'A social deduction game of sightings, silence, and the Boiler Room.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
