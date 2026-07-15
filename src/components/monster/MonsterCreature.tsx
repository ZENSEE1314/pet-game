'use client';

import { useId } from 'react';
import type { MonsterElement, MonsterRarity } from '@prisma/client';
import { ELEMENT_THEME, RARITY_META, type MonsterArchetype } from '@/lib/monsters';
import { cn } from '@/lib/utils';

/**
 * A collectible monster, drawn entirely in animated SVG from three parameters.
 *
 * Element chooses the palette and the drifting aura particles; archetype chooses the
 * silhouette (ears, horns, tail); rarity adds the crown, forehead gem and glow. The
 * result is a cohesive family of 50 creatures with zero image files, transparent by
 * construction, and animated (idle float, breathing, blinking, swaying tail, drifting
 * particles) — the "moving, no background" the collection needs.
 *
 * If a monster is given a real `imageUrl` later, `MonsterArt` (below) renders that PNG
 * instead — so AI art can be dropped in per-monster without touching any consumer.
 */

interface MonsterCreatureProps {
  element: MonsterElement;
  archetype: string;
  rarity: MonsterRarity;
  className?: string;
  animated?: boolean;
  /** Dim to a locked silhouette (used for not-yet-collected slots). */
  silhouette?: boolean;
}

export function MonsterCreature({
  element,
  archetype,
  rarity,
  className,
  animated = true,
  silhouette = false,
}: MonsterCreatureProps) {
  const uid = useId().replace(/:/g, '');
  const theme = ELEMENT_THEME[element];
  const rarityMeta = RARITY_META[rarity];
  const arch = archetype as MonsterArchetype;

  const bodyFill = silhouette ? '#334155' : `url(#body-${uid})`;
  const bellyFill = silhouette ? '#1e293b' : theme.belly;
  const featureInk = silhouette ? '#0f172a' : theme.ink;

  const hasCrown = rarity === 'LEGENDARY' || rarity === 'MYTHIC';
  const hasGem = rarity === 'EPIC' || hasCrown;

  return (
    <svg
      viewBox="0 0 200 220"
      className={cn('h-full w-full overflow-visible', className)}
      role="img"
      aria-label={`${theme.label} ${arch}`}
    >
      <defs>
        <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.bodyFrom} />
          <stop offset="100%" stopColor={theme.bodyTo} />
        </linearGradient>
        <radialGradient id={`aura-${uid}`}>
          <stop offset="0%" stopColor={theme.aura} stopOpacity="0.55" />
          <stop offset="70%" stopColor={theme.aura} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Aura glow */}
      {!silhouette ? (
        <circle
          cx="100"
          cy="112"
          r="86"
          fill={`url(#aura-${uid})`}
          className={animated ? 'mon-glow' : undefined}
        />
      ) : null}

      {/* Drifting element particles */}
      {animated && !silhouette ? <Particles uid={uid} theme={theme} /> : null}

      {/* The creature floats and breathes as one unit. */}
      <g className={animated ? 'mon-float' : undefined} style={{ transformOrigin: '100px 120px' }}>
        {/* Tail (behind the body) */}
        <g
          className={animated ? 'mon-sway' : undefined}
          style={{ transformOrigin: '138px 150px' }}
        >
          <Tail arch={arch} fill={bodyFill} ink={featureInk} auraTip={theme.aura} silhouette={silhouette} />
        </g>

        <g className={animated ? 'mon-breathe' : undefined} style={{ transformOrigin: '100px 165px' }}>
          {/* Feet */}
          <ellipse cx="82" cy="176" rx="16" ry="11" fill={bodyFill} stroke={featureInk} strokeWidth="2.5" />
          <ellipse cx="118" cy="176" rx="16" ry="11" fill={bodyFill} stroke={featureInk} strokeWidth="2.5" />

          {/* Body */}
          <ellipse cx="100" cy="140" rx="46" ry="42" fill={bodyFill} stroke={featureInk} strokeWidth="3" />
          <ellipse cx="100" cy="150" rx="26" ry="24" fill={bellyFill} opacity={silhouette ? 0.3 : 0.55} />

          {/* Arms */}
          <ellipse cx="60" cy="140" rx="11" ry="16" fill={bodyFill} stroke={featureInk} strokeWidth="2.5" transform="rotate(18 60 140)" />
          <ellipse cx="140" cy="140" rx="11" ry="16" fill={bodyFill} stroke={featureInk} strokeWidth="2.5" transform="rotate(-18 140 140)" />
        </g>

        {/* Head group */}
        <g>
          <Ears arch={arch} fill={bodyFill} ink={featureInk} belly={bellyFill} silhouette={silhouette} />

          {/* Head */}
          <circle cx="100" cy="86" r="44" fill={bodyFill} stroke={featureInk} strokeWidth="3" />

          <Muzzle arch={arch} belly={bellyFill} ink={featureInk} silhouette={silhouette} />

          {/* Cheeks */}
          {!silhouette ? (
            <>
              <circle cx="70" cy="94" r="8" fill="#fb7185" opacity="0.4" />
              <circle cx="130" cy="94" r="8" fill="#fb7185" opacity="0.4" />
            </>
          ) : null}

          {/* Eyes (blink together) */}
          <g className={animated ? 'mon-blink' : undefined} style={{ transformOrigin: '100px 82px' }}>
            <Eye cx={82} cy={82} ink={featureInk} silhouette={silhouette} />
            <Eye cx={118} cy={82} ink={featureInk} silhouette={silhouette} />
          </g>

          {/* Forehead gem for epic+ */}
          {hasGem && !silhouette ? (
            <path
              d="M100 54 l7 8 -7 9 -7 -9 z"
              fill={rarityMeta.glow}
              stroke={featureInk}
              strokeWidth="2"
              className={animated ? 'mon-twinkle' : undefined}
              style={{ transformOrigin: '100px 62px' }}
            />
          ) : null}

          {/* Crown for legendary/mythic */}
          {hasCrown && !silhouette ? (
            <g transform="translate(100 40)">
              <path
                d="M-22 6 L-22 -8 L-11 2 L0 -12 L11 2 L22 -8 L22 6 Z"
                fill={rarity === 'MYTHIC' ? '#ec4899' : '#fbbf24'}
                stroke={featureInk}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="0" cy="-4" r="3" fill="#fff" />
            </g>
          ) : null}
        </g>
      </g>

      {silhouette ? (
        <text x="100" y="118" textAnchor="middle" fontSize="52" fontWeight="800" fill="#64748b">
          ?
        </text>
      ) : null}
    </svg>
  );
}

function Eye({ cx, cy, ink, silhouette }: { cx: number; cy: number; ink: string; silhouette: boolean }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="10" ry="12" fill={silhouette ? '#0f172a' : '#fff'} stroke={ink} strokeWidth="2.5" />
      <circle cx={cx} cy={cy + 1} r="6" fill={ink} />
      {!silhouette ? <circle cx={cx + 2} cy={cy - 2} r="2.4" fill="#fff" /> : null}
    </g>
  );
}

function Muzzle({
  arch,
  belly,
  ink,
  silhouette,
}: {
  arch: MonsterArchetype;
  belly: string;
  ink: string;
  silhouette: boolean;
}) {
  const snouted = arch === 'wolf' || arch === 'fox' || arch === 'dragon' || arch === 'bear';
  return (
    <g>
      {snouted && !silhouette ? (
        <ellipse cx="100" cy="104" rx="18" ry="13" fill={belly} opacity="0.7" />
      ) : null}
      {/* Nose */}
      <path d="M94 100 h12 l-6 7 z" fill={ink} />
      {/* Smile */}
      <path
        d="M88 108 q12 12 24 0"
        stroke={ink}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function Ears({
  arch,
  fill,
  ink,
  belly,
  silhouette,
}: {
  arch: MonsterArchetype;
  fill: string;
  ink: string;
  belly: string;
  silhouette: boolean;
}) {
  const inner = silhouette ? '#1e293b' : belly;
  const stroke = { fill, stroke: ink, strokeWidth: 3 };

  switch (arch) {
    case 'fox':
    case 'wolf':
      return (
        <>
          <path d="M66 58 L58 20 L92 46 Z" {...stroke} strokeLinejoin="round" />
          <path d="M134 58 L142 20 L108 46 Z" {...stroke} strokeLinejoin="round" />
          <path d="M70 52 L65 32 L84 46 Z" fill={inner} />
          <path d="M130 52 L135 32 L116 46 Z" fill={inner} />
        </>
      );
    case 'dragon':
      return (
        <>
          <path d="M70 52 Q56 24 78 30 L82 48 Z" {...stroke} strokeLinejoin="round" />
          <path d="M130 52 Q144 24 122 30 L118 48 Z" {...stroke} strokeLinejoin="round" />
        </>
      );
    case 'rabbit':
      return (
        <>
          <ellipse cx="80" cy="34" rx="9" ry="26" {...stroke} transform="rotate(-10 80 34)" />
          <ellipse cx="120" cy="34" rx="9" ry="26" {...stroke} transform="rotate(10 120 34)" />
          <ellipse cx="80" cy="34" rx="4" ry="18" fill={inner} transform="rotate(-10 80 34)" />
          <ellipse cx="120" cy="34" rx="4" ry="18" fill={inner} transform="rotate(10 120 34)" />
        </>
      );
    case 'bird':
      return (
        <>
          <path d="M100 44 L88 18 L100 30 L112 18 Z" {...stroke} strokeLinejoin="round" />
        </>
      );
    case 'golem':
      return (
        <>
          <path d="M66 56 L60 34 L84 48 Z" {...stroke} strokeLinejoin="round" />
          <path d="M134 56 L140 34 L116 48 Z" {...stroke} strokeLinejoin="round" />
          <rect x="94" y="26" width="12" height="14" rx="2" {...stroke} />
        </>
      );
    case 'serpent':
      return (
        <>
          <path d="M78 48 Q72 30 90 40" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M122 48 Q128 30 110 40" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'turtle':
      return null;
    case 'bear':
      return (
        <>
          <circle cx="70" cy="54" r="14" {...stroke} />
          <circle cx="130" cy="54" r="14" {...stroke} />
          <circle cx="70" cy="54" r="7" fill={inner} />
          <circle cx="130" cy="54" r="7" fill={inner} />
        </>
      );
    case 'cub':
    default:
      return (
        <>
          <circle cx="68" cy="56" r="15" {...stroke} />
          <circle cx="132" cy="56" r="15" {...stroke} />
          <circle cx="68" cy="56" r="8" fill={inner} />
          <circle cx="132" cy="56" r="8" fill={inner} />
        </>
      );
  }
}

function Tail({
  arch,
  fill,
  ink,
  auraTip,
  silhouette,
}: {
  arch: MonsterArchetype;
  fill: string;
  ink: string;
  auraTip: string;
  silhouette: boolean;
}) {
  const stroke = { fill, stroke: ink, strokeWidth: 3 };
  const tip = silhouette ? '#334155' : auraTip;

  switch (arch) {
    case 'fox':
      return (
        <path d="M140 155 Q182 150 176 118 Q168 138 150 140 Z" {...stroke} strokeLinejoin="round" />
      );
    case 'dragon':
      return (
        <>
          <path d="M140 158 Q184 158 182 128" fill="none" stroke={ink} strokeWidth="8" strokeLinecap="round" />
          <path d="M140 158 Q184 158 182 128" fill="none" stroke={fill} strokeWidth="4" strokeLinecap="round" />
          <path d="M182 128 l10 -12 -2 14 12 2 z" fill={tip} stroke={ink} strokeWidth="2" strokeLinejoin="round" />
        </>
      );
    case 'serpent':
      return (
        <path d="M138 162 Q188 168 178 132 Q186 150 150 152 Z" {...stroke} strokeLinejoin="round" />
      );
    case 'rabbit':
      return <circle cx="150" cy="160" r="12" fill={silhouette ? '#334155' : '#fff'} stroke={ink} strokeWidth="2.5" />;
    case 'wolf':
      return (
        <path d="M140 152 Q180 148 174 112 Q170 136 148 142 Z" {...stroke} strokeLinejoin="round" />
      );
    case 'turtle':
    case 'bird':
      return <path d="M142 158 q22 4 20 20 q-14 -6 -22 -12 z" {...stroke} strokeLinejoin="round" />;
    case 'cub':
    default:
      return (
        <>
          <path d="M142 156 Q176 156 172 126" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round" />
          <path d="M142 156 Q176 156 172 126" fill="none" stroke={fill} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="172" cy="124" r="8" fill={tip} stroke={ink} strokeWidth="2.5" />
        </>
      );
  }
}

function Particles({ uid, theme }: { uid: string; theme: (typeof ELEMENT_THEME)[MonsterElement] }) {
  // Six particles at staggered delays and x-positions, drifting upward.
  const spots = [
    { x: 52, delay: 0 },
    { x: 148, delay: 0.5 },
    { x: 40, delay: 1.1 },
    { x: 160, delay: 1.6 },
    { x: 100, delay: 0.8 },
    { x: 76, delay: 2.0 },
  ];

  return (
    <g>
      {spots.map((spot, i) => (
        <g
          key={`${uid}-${i}`}
          className="mon-drift"
          style={{ transformOrigin: `${spot.x}px 150px`, animationDelay: `${spot.delay}s` }}
        >
          <Particle x={spot.x} kind={theme.particle} color={theme.aura} />
        </g>
      ))}
    </g>
  );
}

function Particle({ x, kind, color }: { x: number; kind: ElementTheme['particle']; color: string }) {
  const y = 150;
  switch (kind) {
    case 'bubble':
    case 'snow':
      return <circle cx={x} cy={y} r="4" fill={kind === 'snow' ? '#fff' : color} opacity="0.8" />;
    case 'ember':
    case 'spark':
      return <circle cx={x} cy={y} r="3" fill={color} />;
    case 'leaf':
      return <path d={`M${x} ${y} q6 -4 0 -10 q-6 6 0 10 z`} fill={color} />;
    case 'star':
    case 'sparkle':
      return <path d={`M${x} ${y - 5} l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 z`} fill={color} />;
    case 'gear':
      return <rect x={x - 3} y={y - 3} width="6" height="6" rx="1.5" fill={color} transform={`rotate(20 ${x} ${y})`} />;
    case 'dust':
    case 'wisp':
    default:
      return <circle cx={x} cy={y} r="3.5" fill={color} opacity="0.7" />;
  }
}

type ElementTheme = (typeof ELEMENT_THEME)[MonsterElement];

// --- Art with optional AI override ------------------------------------------

/**
 * Renders a monster's AI art PNG when one exists, and the procedural creature
 * otherwise. Every consumer uses this rather than MonsterCreature directly, so adding
 * real art to a monster is a one-field change with no code edits anywhere else.
 */
export function MonsterArt({
  imageUrl,
  element,
  archetype,
  rarity,
  name,
  className,
  animated = true,
  silhouette = false,
}: MonsterCreatureProps & { imageUrl?: string | null; name?: string }) {
  if (imageUrl && !silhouette) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? 'Monster'}
        className={cn('h-full w-full object-contain', animated && 'mon-float', className)}
        loading="lazy"
      />
    );
  }

  return (
    <MonsterCreature
      element={element}
      archetype={archetype}
      rarity={rarity}
      className={className}
      animated={animated}
      silhouette={silhouette}
    />
  );
}
