import Link from 'next/link';
import { MultiplayerClient } from './MultiplayerClient';

export default function MultiplayerPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-6">
        <Link href="/" className="text-sm text-[var(--fog)] hover:text-[var(--ember-hot)]">
          ← Home
        </Link>
        <p className="text-xs tracking-[0.16em] text-[var(--fog-dim)] uppercase">Online lobby</p>
      </div>
      <MultiplayerClient />
    </main>
  );
}
