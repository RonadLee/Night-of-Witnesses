import Link from 'next/link';
import { MultiplayerClient } from './MultiplayerClient';

export const dynamic = 'force-dynamic';

export default async function MultiplayerPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const params = await searchParams;
  const initialCode = (params.room ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-6">
        <Link href="/" className="text-sm text-[var(--fog)] hover:text-[var(--ember-hot)]">
          ← Home
        </Link>
        <p className="text-xs tracking-[0.16em] text-[var(--fog-dim)] uppercase">Multiplayer</p>
      </div>
      <MultiplayerClient initialCode={initialCode} />
    </main>
  );
}
