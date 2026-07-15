import type { MonsterElement, MonsterRarity } from '@prisma/client';

/**
 * The monster catalogue: 50 collectible creatures, ten elemental families of five.
 *
 * The art is not fifty image files. Each monster is drawn procedurally by
 * `MonsterCreature` from three parameters — element (palette + aura), archetype
 * (silhouette) and rarity (embellishments) — so the whole set is consistent, animated
 * and weightless. A monster's `imageUrl` stays null until someone drops an AI-rendered
 * PNG in for it, at which point the collection shows the PNG instead. The catalogue is
 * the single source of truth; `prisma/seed.ts` writes it into the database verbatim.
 */

export const PUZZLE_PIECE_COUNT = 9; // 3x3

export interface ElementTheme {
  label: string;
  /** Body gradient, top → bottom. */
  bodyFrom: string;
  bodyTo: string;
  /** Belly / highlight. */
  belly: string;
  /** Aura particles + glow. */
  aura: string;
  /** Ink for outlines and facial features. */
  ink: string;
  /** The kind of particle that drifts around the creature. */
  particle: 'ember' | 'bubble' | 'dust' | 'spark' | 'leaf' | 'snow' | 'wisp' | 'sparkle' | 'gear' | 'star';
}

export const ELEMENT_THEME: Record<MonsterElement, ElementTheme> = {
  FIRE: { label: 'Fire', bodyFrom: '#fb923c', bodyTo: '#ef4444', belly: '#fed7aa', aura: '#f97316', ink: '#7c2d12', particle: 'ember' },
  WATER: { label: 'Water', bodyFrom: '#38bdf8', bodyTo: '#2563eb', belly: '#e0f2fe', aura: '#0ea5e9', ink: '#0c4a6e', particle: 'bubble' },
  EARTH: { label: 'Earth', bodyFrom: '#d6b27a', bodyTo: '#a16207', belly: '#f5e6c8', aura: '#ca8a04', ink: '#452c0f', particle: 'dust' },
  STORM: { label: 'Storm', bodyFrom: '#a78bfa', bodyTo: '#6d28d9', belly: '#ede9fe', aura: '#facc15', ink: '#3b0764', particle: 'spark' },
  NATURE: { label: 'Nature', bodyFrom: '#4ade80', bodyTo: '#15803d', belly: '#dcfce7', aura: '#22c55e', ink: '#14532d', particle: 'leaf' },
  ICE: { label: 'Ice', bodyFrom: '#a5f3fc', bodyTo: '#38bdf8', belly: '#ecfeff', aura: '#67e8f9', ink: '#155e75', particle: 'snow' },
  SHADOW: { label: 'Shadow', bodyFrom: '#7c3aed', bodyTo: '#3b0764', belly: '#c4b5fd', aura: '#a855f7', ink: '#1e1b4b', particle: 'wisp' },
  LIGHT: { label: 'Light', bodyFrom: '#fde68a', bodyTo: '#f59e0b', belly: '#fffbeb', aura: '#fbbf24', ink: '#78350f', particle: 'sparkle' },
  METAL: { label: 'Metal', bodyFrom: '#cbd5e1', bodyTo: '#64748b', belly: '#f1f5f9', aura: '#94a3b8', ink: '#1e293b', particle: 'gear' },
  COSMIC: { label: 'Cosmic', bodyFrom: '#818cf8', bodyTo: '#c026d3', belly: '#e9d5ff', aura: '#a78bfa', ink: '#1e1b4b', particle: 'star' },
};

/** The silhouette an archetype draws — ears, horns, tail, muzzle. */
export type MonsterArchetype =
  | 'cub'
  | 'wolf'
  | 'dragon'
  | 'bird'
  | 'golem'
  | 'fox'
  | 'bear'
  | 'serpent'
  | 'rabbit'
  | 'turtle';

export const RARITY_META: Record<
  MonsterRarity,
  { label: string; badge: string; glow: string; dropWeight: number; unlockGems: number; unlockPoints: number }
> = {
  COMMON: { label: 'Common', badge: '#94a3b8', glow: '#cbd5e1', dropWeight: 100, unlockGems: 2, unlockPoints: 0 },
  RARE: { label: 'Rare', badge: '#3b82f6', glow: '#93c5fd', dropWeight: 55, unlockGems: 5, unlockPoints: 2 },
  EPIC: { label: 'Epic', badge: '#a855f7', glow: '#d8b4fe', dropWeight: 26, unlockGems: 10, unlockPoints: 5 },
  LEGENDARY: { label: 'Legendary', badge: '#f59e0b', glow: '#fcd34d', dropWeight: 10, unlockGems: 20, unlockPoints: 10 },
  MYTHIC: { label: 'Mythic', badge: '#ec4899', glow: '#f9a8d4', dropWeight: 3, unlockGems: 40, unlockPoints: 20 },
};

export interface MonsterDef {
  slug: string;
  name: string;
  element: MonsterElement;
  rarity: MonsterRarity;
  archetype: MonsterArchetype;
  description: string;
}

interface FamilySpec {
  element: MonsterElement;
  names: [string, string, string, string, string];
  archetypes: [MonsterArchetype, MonsterArchetype, MonsterArchetype, MonsterArchetype, MonsterArchetype];
  blurb: (name: string) => string;
}

const RARITY_ORDER: MonsterRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

const FAMILIES: FamilySpec[] = [
  {
    element: 'FIRE',
    names: ['Emberkit', 'Cindertail', 'Blazewolf', 'Pyrewyrm', 'Phoenixling'],
    archetypes: ['cub', 'fox', 'wolf', 'dragon', 'bird'],
    blurb: (n) => `${n} radiates a warmth that never quite burns, and its mane crackles when it's happy.`,
  },
  {
    element: 'WATER',
    names: ['Dewpup', 'Ripplefin', 'Tidalpaw', 'Marisnake', 'Leviamyth'],
    archetypes: ['cub', 'turtle', 'bear', 'serpent', 'dragon'],
    blurb: (n) => `${n} leaves tiny puddles wherever it naps, each one perfectly round.`,
  },
  {
    element: 'EARTH',
    names: ['Pebblepup', 'Burrowkit', 'Boulderbear', 'Terragolem', 'Titanshell'],
    archetypes: ['cub', 'rabbit', 'bear', 'golem', 'turtle'],
    blurb: (n) => `${n} hums a low, steady note that makes small stones roll toward it.`,
  },
  {
    element: 'STORM',
    names: ['Sparkit', 'Voltfox', 'Thunderwolf', 'Galewyrm', 'Stormcrown'],
    archetypes: ['cub', 'fox', 'wolf', 'dragon', 'bird'],
    blurb: (n) => `${n} makes the fur of everyone nearby stand faintly on end.`,
  },
  {
    element: 'NATURE',
    names: ['Sproutkit', 'Mossbun', 'Thornbear', 'Bloomserpent', 'Verdantking'],
    archetypes: ['cub', 'rabbit', 'bear', 'serpent', 'golem'],
    blurb: (n) => `${n} grows a fresh flower behind its ear each morning and forgets by noon.`,
  },
  {
    element: 'ICE',
    names: ['Frostkit', 'Snowbun', 'Glacierpaw', 'Frostwyrm', 'Auroraking'],
    archetypes: ['cub', 'rabbit', 'bear', 'dragon', 'bird'],
    blurb: (n) => `${n} breathes little clouds even in summer and refuses to admit it's cold.`,
  },
  {
    element: 'SHADOW',
    names: ['Duskit', 'Wispfox', 'Nightwolf', 'Umbraserpent', 'Voidcrown'],
    archetypes: ['cub', 'fox', 'wolf', 'serpent', 'golem'],
    blurb: (n) => `${n} borrows the shadows of nearby friends and gives them back, mostly.`,
  },
  {
    element: 'LIGHT',
    names: ['Glimmerkit', 'Sunbun', 'Radibear', 'Solardrake', 'Dawnseraph'],
    archetypes: ['cub', 'rabbit', 'bear', 'dragon', 'bird'],
    blurb: (n) => `${n} glows a little brighter whenever someone smiles at it.`,
  },
  {
    element: 'METAL',
    names: ['Boltkit', 'Cogfox', 'Ironpaw', 'Chromewyrm', 'Aegisgolem'],
    archetypes: ['cub', 'fox', 'bear', 'dragon', 'golem'],
    blurb: (n) => `${n} pings softly when tapped and is inordinately proud of it.`,
  },
  {
    element: 'COSMIC',
    names: ['Starkit', 'Cometfox', 'Nebulapaw', 'Astralwyrm', 'Galaxarch'],
    archetypes: ['cub', 'fox', 'bear', 'dragon', 'bird'],
    blurb: (n) => `${n} carries a tiny galaxy in its belly that twinkles when it laughs.`,
  },
];

// Each element contributes one monster at each rarity tier, in ascending order — so
// the catalogue's natural order is Fire-common … Fire-mythic, Water-common …, which is
// exactly how the collection grid reads.
export const MONSTERS: MonsterDef[] = FAMILIES.flatMap((family) =>
  RARITY_ORDER.map((rarity, tier) => {
    const name = family.names[tier]!;
    return {
      slug: `${family.element.toLowerCase()}-${name.toLowerCase()}`,
      name,
      element: family.element,
      rarity,
      archetype: family.archetypes[tier]!,
      description: family.blurb(name),
    } satisfies MonsterDef;
  }),
);

export function sortOrderFor(slug: string): number {
  return MONSTERS.findIndex((m) => m.slug === slug);
}
