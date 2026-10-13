import { MultiplayerClient } from './MultiplayerClient';
import { ModeChrome } from '@/components/ModeChrome';

export const dynamic = 'force-dynamic';

export default async function MultiplayerPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const params = await searchParams;
  const initialCode = (params.room ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return (
    <ModeChrome>
      <MultiplayerClient initialCode={initialCode} />
    </ModeChrome>
  );
}
