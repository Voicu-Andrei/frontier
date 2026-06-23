export type ThemeId = "paper" | "carbon" | "blueprint";

export const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "paper", label: "Paper", swatch: "#1a73e8" },
  { id: "carbon", label: "Carbon", swatch: "#1ff0d6" },
  { id: "blueprint", label: "Blueprint", swatch: "#22d3ee" },
];

/** CSS custom properties read off the themed root for canvas drawing. */
export interface Palette {
  bg: string;
  mapLand: string;
  mapWater: string;
  mapPark: string;
  roadCasing: string;
  road: string;
  roadMinor: string;
  routeA: string;
  routeB: string;
  routeCasing: string;
  frontierSettle: string;
  frontierWave1: string;
  frontierWave2: string;
  start: string;
  end: string;
  accent: string;
  accentInk: string;
  algoA: string;
  algoB: string;
  ink: string;
  inkFaint: string;
  hairline: string;
}

const VARS: Record<keyof Palette, string> = {
  bg: "--bg",
  mapLand: "--map-land",
  mapWater: "--map-water",
  mapPark: "--map-park",
  roadCasing: "--map-road-casing",
  road: "--map-road",
  roadMinor: "--map-road-minor",
  routeA: "--route-a",
  routeB: "--route-b",
  routeCasing: "--route-casing",
  frontierSettle: "--frontier-settle",
  frontierWave1: "--frontier-wave-1",
  frontierWave2: "--frontier-wave-2",
  start: "--start",
  end: "--end",
  accent: "--accent",
  accentInk: "--accent-ink",
  algoA: "--algo-a",
  algoB: "--algo-b",
  ink: "--ink",
  inkFaint: "--ink-faint",
  hairline: "--hairline",
};

/** Resolve the current theme's tokens into concrete colours for the canvas. */
export function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const out = {} as Palette;
  for (const key of Object.keys(VARS) as (keyof Palette)[]) {
    out[key] = cs.getPropertyValue(VARS[key]).trim();
  }
  return out;
}
