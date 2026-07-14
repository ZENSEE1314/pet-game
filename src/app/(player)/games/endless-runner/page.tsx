'use client';

import { GameShell } from '@/components/game/GameShell';
import { createEndlessRunner } from '@/components/game/endless-runner';

export default function EndlessRunnerPage() {
  return (
    <GameShell
      slug="ENDLESS_RUNNER"
      title="Endless Runner"
      instructions="Jump the obstacles, grab the coins, survive."
      controls={[
        'Space / ↑ / W — jump',
        'Tap anywhere — jump',
        'Three lives. Speed climbs the longer you last.',
      ]}
      createGame={createEndlessRunner}
    />
  );
}
