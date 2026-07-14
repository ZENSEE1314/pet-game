'use client';

import { GameShell } from '@/components/game/GameShell';
import { createFeedingCatch } from '@/components/game/feeding-catch';

export default function FeedingCatchPage() {
  return (
    <GameShell
      slug="FEEDING_CATCH"
      title="Feeding Catch"
      instructions="Catch the good food. Dodge the rotten stuff. 60 seconds."
      controls={[
        '← / → — move',
        'Drag anywhere — move',
        'Green +10 · Gold +25 · Pink +60 · Grey costs a life',
        'Every 5 catches in a row raises your multiplier (max 5×).',
      ]}
      createGame={createFeedingCatch}
    />
  );
}
