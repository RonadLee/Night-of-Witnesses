import { Suspense } from 'react';
import { SoloClient } from './SoloClient';
import { ModeChrome } from '@/components/ModeChrome';

export const dynamic = 'force-dynamic';

export default function SoloPage() {
  return (
    <ModeChrome>
      <Suspense fallback={<p className="px-4 py-10 text-[var(--fog)]">…</p>}>
        <SoloClient />
      </Suspense>
    </ModeChrome>
  );
}
