import { MultiplayerClient } from './MultiplayerClient';
import { ModeChrome } from '@/components/ModeChrome';

export const dynamic = 'force-dynamic';

export default function MultiplayerPage() {
  return (
    <ModeChrome>
      <MultiplayerClient />
    </ModeChrome>
  );
}
