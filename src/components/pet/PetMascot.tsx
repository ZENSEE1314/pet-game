'use client';

import type { PetHealthState, PetStage } from '@prisma/client';
import { cn } from '@/lib/utils';

/**
 * The PetQuest mascot: an original creature drawn entirely in SVG.
 *
 * Deliberately code, not an image file — it scales to any size, it recolours with
 * the pet's mood for free, and there is zero risk of shipping someone else's
 * copyrighted character. When real artwork arrives, swap this component's internals
 * and every consumer keeps working: nothing outside this file knows how the pet is
 * drawn.
 */

interface PetMascotProps {
  stage?: PetStage;
  healthState?: PetHealthState;
  mood?: number;
  isSleeping?: boolean;
  className?: string;
  animate?: boolean;
}

const STAGE_SCALE: Record<PetStage, number> = {
  EGG: 0.7,
  BABY: 0.8,
  YOUNG: 0.9,
  ADULT: 1,
  EVOLVED: 1.08,
};

export function PetMascot({
  stage = 'BABY',
  healthState = 'HEALTHY',
  mood = 80,
  isSleeping = false,
  className,
  animate = true,
}: PetMascotProps) {
  const isSick = healthState === 'SICK';
  const isTired = healthState === 'TIRED';

  // The pet's colour IS its status indicator — a sick pet looks sick before you read
  // a single number.
  const bodyFrom = isSick ? '#9CA3AF' : stage === 'EVOLVED' ? '#F472B6' : '#A78BFA';
  const bodyTo = isSick ? '#6B7280' : stage === 'EVOLVED' ? '#C084FC' : '#8B5CF6';

  const isHappy = mood >= 60 && !isSick;

  if (stage === 'EGG') {
    return (
      <svg viewBox="0 0 200 200" className={cn('h-full w-full', className)} role="img" aria-label="A pet egg">
        <defs>
          <linearGradient id="eggBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="180" rx="45" ry="8" fill="#000" opacity="0.08" />
        <path
          d="M100 30 C 140 30 165 90 165 120 C 165 155 135 175 100 175 C 65 175 35 155 35 120 C 35 90 60 30 100 30 Z"
          fill="url(#eggBody)"
          className={animate ? 'origin-center animate-float' : undefined}
        />
        <path d="M70 100 L 85 90 L 95 105 L 110 92 L 122 108" stroke="#B45309" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  const scale = STAGE_SCALE[stage];

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={`Your pet, currently ${isSick ? 'sick' : isSleeping ? 'asleep' : isHappy ? 'happy' : 'okay'}`}
    >
      <defs>
        <linearGradient id="petBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bodyFrom} />
          <stop offset="100%" stopColor={bodyTo} />
        </linearGradient>
        <radialGradient id="petCheek">
          <stop offset="0%" stopColor="#FB7185" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FB7185" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="182" rx={48 * scale} ry="7" fill="#000" opacity="0.08" />

      <g
        transform={`translate(100 100) scale(${scale}) translate(-100 -100)`}
        className={animate && !isSleeping ? 'animate-float' : undefined}
      >
        {/* Ears */}
        <ellipse cx="62" cy="58" rx="16" ry="24" fill={bodyTo} transform="rotate(-20 62 58)" />
        <ellipse cx="138" cy="58" rx="16" ry="24" fill={bodyTo} transform="rotate(20 138 58)" />

        {/* Body */}
        <ellipse cx="100" cy="120" rx="58" ry="52" fill="url(#petBody)" />
        {/* Head */}
        <circle cx="100" cy="80" r="46" fill="url(#petBody)" />
        {/* Belly */}
        <ellipse cx="100" cy="130" rx="34" ry="30" fill="#fff" opacity="0.25" />

        {/* Eyes: closed when asleep, half-lidded when tired, wide otherwise. */}
        {isSleeping ? (
          <>
            <path d="M76 78 q 10 8 20 0" stroke="#312E81" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M104 78 q 10 8 20 0" stroke="#312E81" strokeWidth="4" fill="none" strokeLinecap="round" />
            <text x="140" y="46" fontSize="20" fill="#A5B4FC" fontWeight="bold">
              z
            </text>
            <text x="152" y="32" fontSize="14" fill="#C7D2FE" fontWeight="bold">
              z
            </text>
          </>
        ) : (
          <>
            <circle cx="84" cy="76" r={isTired ? 7 : 9} fill="#312E81" />
            <circle cx="116" cy="76" r={isTired ? 7 : 9} fill="#312E81" />
            <circle cx="87" cy="73" r="3.5" fill="#fff" />
            <circle cx="119" cy="73" r="3.5" fill="#fff" />
          </>
        )}

        {/* Cheeks */}
        <circle cx="70" cy="92" r="10" fill="url(#petCheek)" />
        <circle cx="130" cy="92" r="10" fill="url(#petCheek)" />

        {/* Mouth follows mood: a smile, a flat line, or a frown. */}
        {isSick ? (
          <path d="M88 100 q 12 -8 24 0" stroke="#312E81" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        ) : isHappy ? (
          <path d="M86 98 q 14 14 28 0" stroke="#312E81" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M88 101 h 24" stroke="#312E81" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        )}

        {/* Feet */}
        <ellipse cx="76" cy="166" rx="17" ry="10" fill={bodyTo} />
        <ellipse cx="124" cy="166" rx="17" ry="10" fill={bodyTo} />

        {/* The Evolved stage earns a little crown. */}
        {stage === 'EVOLVED' ? (
          <path d="M78 40 L 86 22 L 100 34 L 114 22 L 122 40 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />
        ) : null}
      </g>

      {/* Sickness is signalled twice: colour AND an explicit icon. Colour alone would
          be invisible to a colour-blind player. */}
      {isSick ? (
        <g transform="translate(150 40)">
          <circle r="16" fill="#EF4444" />
          <path d="M-6 0 h12 M0 -6 v12" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
}
