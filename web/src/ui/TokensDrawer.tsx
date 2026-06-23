import { useEffect, useState } from "react";
import { useStore } from "../state/store";

type Item = [label: string, varName: string, isColor: boolean];

const GROUPS: { name: string; items: Item[] }[] = [
  {
    name: "Color roles",
    items: [
      ["Map land", "--map-land", true],
      ["Water", "--map-water", true],
      ["Park", "--map-park", true],
      ["Road", "--map-road", true],
      ["Route start", "--route-a", true],
      ["Route end", "--route-b", true],
      ["Frontier wave", "--frontier-wave-1", true],
      ["Frontier hot", "--frontier-wave-2", true],
      ["Frontier settle", "--frontier-settle", true],
      ["Start pin", "--start", true],
      ["End pin", "--end", true],
      ["Accent", "--accent", true],
      ["Ink", "--ink", true],
      ["Ink muted", "--ink-muted", true],
      ["Panel", "--panel", true],
      ["Hairline", "--hairline", true],
    ],
  },
  {
    name: "Typography",
    items: [
      ["Sans / UI", "--font-sans", false],
      ["Mono / readouts", "--font-mono", false],
      ["Caption", "--fs-cap", false],
      ["Base", "--fs-base", false],
      ["Metric", "--fs-md", false],
      ["Title", "--fs-lg", false],
      ["Display", "--fs-xl", false],
    ],
  },
  {
    name: "Spacing",
    items: [
      ["Tight", "--sp-2", false],
      ["Snug", "--sp-3", false],
      ["Base", "--sp-4", false],
      ["Loose", "--sp-5", false],
      ["Section", "--sp-6", false],
    ],
  },
  {
    name: "Radius",
    items: [
      ["Small", "--r-1", false],
      ["Medium", "--r-2", false],
      ["Large", "--r-3", false],
    ],
  },
  {
    name: "Elevation",
    items: [
      ["Level 1", "--e-1", false],
      ["Level 2", "--e-2", false],
      ["Level 3", "--e-3", false],
    ],
  },
  {
    name: "Motion",
    items: [
      ["Fast", "--t-fast", false],
      ["Base", "--t-base", false],
      ["Slow", "--t-slow", false],
      ["Easing", "--ease", false],
    ],
  },
];

export function TokensDrawer() {
  const open = useStore((s) => s.tokensOpen);
  const theme = useStore((s) => s.theme);
  const toggle = useStore((s) => s.toggleTokens);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const el = document.querySelector(".app-root");
    if (!el) return;
    const cs = getComputedStyle(el as HTMLElement);
    const v: Record<string, string> = {};
    for (const g of GROUPS) for (const [, name] of g.items) v[name] = cs.getPropertyValue(name).trim();
    setValues(v);
  }, [open, theme]);

  if (!open) return null;
  return (
    <div className="drawer">
      <div className="drawer-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: "var(--fs-md)", fontWeight: 700 }}>Design tokens</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-micro)", color: "var(--ink-faint)" }}>
            theme: {theme} · reskin = 1 CSS block
          </span>
        </div>
        <button className="drawer-close" onClick={toggle}>
          ×
        </button>
      </div>
      {GROUPS.map((g) => (
        <div className="token-group" key={g.name}>
          <div className="cap" style={{ marginBottom: 9 }}>
            {g.name}
          </div>
          {g.items.map(([label, name, isColor]) => (
            <div className="token-row" key={name}>
              {isColor && <span className="token-swatch" style={{ background: values[name] || "transparent" }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span className="token-name">{label}</span>
                <span className="token-var">{name}</span>
              </div>
              <span className="token-value">{values[name] || "…"}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
