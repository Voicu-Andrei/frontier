import { useStore } from "../state/store";
import { THEMES } from "../theme/themes";
import type { Mode } from "../state/scene";
import { Logo, ModeIcon } from "./icons";

const MODES: { id: Mode; label: string }[] = [
  { id: "p2p", label: "Point" },
  { id: "race", label: "Race" },
  { id: "iso", label: "Iso" },
  { id: "multi", label: "Multi" },
  { id: "dispatch", label: "Dispatch" },
];

export function TopBar() {
  const mode = useStore((s) => s.mode);
  const theme = useStore((s) => s.theme);
  const weight = useStore((s) => s.weight);
  const tokensOpen = useStore((s) => s.tokensOpen);
  const setMode = useStore((s) => s.setMode);
  const setTheme = useStore((s) => s.setTheme);
  const setWeight = useStore((s) => s.setWeight);
  const toggleTokens = useStore((s) => s.toggleTokens);

  return (
    <div className="topbar">
      <div className="brand">
        <Logo />
        <span className="brand-name">RouteLab</span>
        <span className="brand-ver">v0.4</span>
      </div>
      <div className="spacer" />

      <div className="pillgroup">
        {MODES.map((m) => (
          <button key={m.id} className={`pill${mode === m.id ? " active" : ""}`} onClick={() => setMode(m.id)}>
            <ModeIcon mode={m.id} />
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="spacer" />

      <div className="pillgroup">
        <button
          className={`pill pill-sm${weight === "time" ? " active" : ""}`}
          onClick={() => setWeight("time")}
        >
          TIME
        </button>
        <button
          className={`pill pill-sm${weight === "distance" ? " active" : ""}`}
          onClick={() => setWeight("distance")}
        >
          DIST
        </button>
      </div>

      <div className="pillgroup">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`pill pill-sm${theme === t.id ? " active" : ""}`}
            onClick={() => setTheme(t.id)}
          >
            <span className="swatch" style={{ background: t.swatch }} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <button className={`tokens-btn${tokensOpen ? " active" : ""}`} onClick={toggleTokens}>
        TOKENS
      </button>
    </div>
  );
}
