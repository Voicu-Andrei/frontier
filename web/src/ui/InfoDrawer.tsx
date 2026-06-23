import { useStore } from "../state/store";
import type { Mode } from "../state/scene";

interface Info {
  title: string;
  algo: string;
  complexity: string;
  idea: string;
  steps: string[];
  note: string;
}

const INFO: Record<Mode, Info> = {
  p2p: {
    title: "Point-to-point routing",
    algo: "A* search",
    complexity: "O((V + E) log V)",
    idea:
      "A* is Dijkstra with a sense of direction. It still expands the cheapest-so-far node, but it adds a heuristic h(n) — a straight-line lower bound on the remaining distance — so it preferentially explores toward the target instead of in all directions.",
    steps: [
      "Priority = g(n) + h(n): cost so far plus optimistic cost-to-go.",
      "Pop the lowest-priority node from the heap, mark it settled.",
      "Relax its neighbours, updating their best cost and predecessor.",
      "Stop the moment the target is settled — its cost is provably optimal.",
    ],
    note:
      "Because h never overestimates (admissible), the path is guaranteed shortest — verified against plain Dijkstra in the tests.",
  },
  bidir: {
    title: "Bidirectional search",
    algo: "Bidirectional Dijkstra",
    complexity: "O((V + E) log V), ~½ the nodes",
    idea:
      "Run two searches at once: one forward from the start, one backward from the destination over the reversed graph. Each only has to grow a half-radius ball before they collide in the middle, so together they settle far fewer nodes than one search covering the full radius.",
    steps: [
      "Alternate: advance whichever frontier is currently cheaper.",
      "Track μ, the best start→meet→end cost found whenever the frontiers touch.",
      "Stop once the two smallest frontier keys sum to ≥ μ — nothing shorter can remain.",
      "Stitch the path: start → meeting node (forward) + meeting node → end (backward).",
    ],
    note:
      "This is the trick real routers use. The readout shows total nodes vs a one-directional Dijkstra on the same query.",
  },
  race: {
    title: "Race / benchmark",
    algo: "Dijkstra vs A*",
    complexity: "same big-O, different constants",
    idea:
      "Both algorithms find the same optimal route, but explore very differently. Run them on one query, side by side, and measure the gap — turning a big-O claim into evidence.",
    steps: [
      "Left pane: Dijkstra expands a uniform circle outward from the start.",
      "Right pane: A* expands a narrow teardrop biased toward the target.",
      "Count settled nodes and wall-clock time for each.",
      "The speedup is the ratio of nodes explored.",
    ],
    note: "Timing is measured with no animation/trace overhead in the loop, so the numbers are honest.",
  },
  iso: {
    title: "Isochrone — reachability",
    algo: "Bounded Dijkstra",
    complexity: "O((V + E) log V)",
    idea:
      "“How far can someone get from here in N minutes?” Run Dijkstra with a time budget and no target: it settles every node whose travel time is within the budget. The reachable boundary bulges along fast roads and pulls in where the network is slow — never a plain circle.",
    steps: [
      "Flood outward from the origin in order of travel time.",
      "Stop expanding a node once its time exceeds the budget.",
      "Wrap the reachable nodes into a concave boundary per direction.",
      "Draw nested contours for fractions of the budget (e.g. ⅓, ⅔, full).",
    ],
    note: "The result is static — set the minutes and read the area. Scrubbing replays the real arrival-time wavefront.",
  },
  multi: {
    title: "Multi-stop routing",
    algo: "TSP · nearest-neighbour",
    complexity: "NP-hard; heuristic here",
    idea:
      "Visiting several stops in the best order is the Travelling Salesman Problem — there's no known efficient exact algorithm. We build an all-pairs cost matrix with the routing engine, then order the stops greedily (always go to the nearest unvisited one) and route the real roads between them.",
    steps: [
      "Compute shortest cost between every pair of stops (A*).",
      "Start at the first stop; repeatedly jump to the nearest unvisited stop.",
      "Stitch the real road path for each consecutive leg.",
      "(Exact Held-Karp for small n is a planned upgrade.)",
    ],
    note: "Click the map to add stops; Undo/Clear to edit. The order label is marked OPT* — heuristic, not guaranteed optimal.",
  },
  dispatch: {
    title: "Nearest-unit dispatch",
    algo: "Multi-source Dijkstra",
    complexity: "O((V + E) log V)",
    idea:
      "Which unit reaches each call first? Seed Dijkstra with every unit at cost 0 simultaneously. The frontiers compete, and each node gets labelled with its nearest unit — carving the map into response territories in a single search instead of one per unit.",
    steps: [
      "Push all unit locations into the queue at distance 0.",
      "Expand normally; each node inherits the origin of whoever reaches it first.",
      "A call's nearest unit is just its origin label.",
      "Trace each call back along predecessors to its assigned unit.",
    ],
    note: "Place units and calls by clicking (toggle which you're dropping). The frontier shows the competing territories grow.",
  },
};

function Diagram({ mode }: { mode: Mode }) {
  const acc = "var(--accent)";
  const muted = "var(--ink-faint)";
  const w1 = "var(--frontier-wave-1)";
  const w2 = "var(--frontier-wave-2)";
  const end = "var(--end)";
  const start = "var(--start)";
  const box = { width: "100%", height: 150, display: "block" } as const;

  switch (mode) {
    case "bidir":
      return (
        <svg viewBox="0 0 300 150" style={box}>
          <circle cx="80" cy="75" r="46" fill={acc} opacity="0.12" />
          <circle cx="80" cy="75" r="30" fill={acc} opacity="0.16" />
          <circle cx="220" cy="75" r="46" fill={w1} opacity="0.12" />
          <circle cx="220" cy="75" r="30" fill={w1} opacity="0.16" />
          <circle cx="80" cy="75" r="6" fill={start} />
          <circle cx="220" cy="75" r="6" fill={end} />
          <rect x="144" y="69" width="12" height="12" rx="2" fill={w2} transform="rotate(45 150 75)" />
          <text x="80" y="135" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">start</text>
          <text x="220" y="135" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">end</text>
        </svg>
      );
    case "race":
      return (
        <svg viewBox="0 0 300 150" style={box}>
          <circle cx="75" cy="70" r="48" fill={acc} opacity="0.14" />
          <circle cx="75" cy="70" r="6" fill={start} />
          <circle cx="120" cy="40" r="6" fill={end} />
          <path d="M225 70 Q225 40 270 40 Q235 55 270 70 Q235 85 270 100 Q225 100 225 70Z" fill={w1} opacity="0.18" />
          <circle cx="200" cy="70" r="6" fill={start} />
          <circle cx="270" cy="40" r="6" fill={end} />
          <text x="75" y="138" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">Dijkstra</text>
          <text x="235" y="138" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">A*</text>
        </svg>
      );
    case "iso":
      return (
        <svg viewBox="0 0 300 150" style={box}>
          <path d="M150 25 Q210 35 235 75 Q215 120 150 128 Q85 120 70 75 Q95 40 150 25Z" fill={w1} opacity="0.14" stroke={w1} strokeWidth="1.5" />
          <path d="M150 50 Q190 58 205 78 Q190 105 150 110 Q108 102 100 78 Q118 60 150 50Z" fill={w1} opacity="0.16" stroke={w1} strokeWidth="1.5" />
          <path d="M150 66 Q172 72 180 82 Q170 96 150 98 Q130 94 126 82 Q135 70 150 66Z" fill={w2} opacity="0.26" stroke={w2} strokeWidth="1.5" />
          <circle cx="150" cy="82" r="5" fill={start} />
          <text x="150" y="142" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">5 · 10 · 15 min</text>
        </svg>
      );
    case "multi":
      return (
        <svg viewBox="0 0 300 150" style={box}>
          <polyline points="50,110 95,45 165,30 245,70 200,120 50,110" fill="none" stroke={acc} strokeWidth="2.5" strokeLinejoin="round" />
          {[[50, 110], [95, 45], [165, 30], [245, 70], [200, 120]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="8" fill={i === 0 ? start : acc} stroke="#fff" strokeWidth="2" />
              <text x={x} y={y + 4} fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">{i === 0 ? "S" : i}</text>
            </g>
          ))}
        </svg>
      );
    case "dispatch":
      return (
        <svg viewBox="0 0 300 150" style={box}>
          <circle cx="80" cy="55" r="40" fill={acc} opacity="0.12" />
          <circle cx="215" cy="95" r="40" fill={w1} opacity="0.12" />
          <line x1="80" y1="55" x2="135" y2="80" stroke={acc} strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
          <line x1="215" y1="95" x2="160" y2="60" stroke={w1} strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
          <rect x="73" y="48" width="14" height="14" rx="2" fill={acc} transform="rotate(45 80 55)" />
          <rect x="208" y="88" width="14" height="14" rx="2" fill={acc} transform="rotate(45 215 95)" />
          <circle cx="135" cy="80" r="6" fill="none" stroke={end} strokeWidth="3" />
          <circle cx="160" cy="60" r="6" fill="none" stroke={end} strokeWidth="3" />
          <text x="150" y="140" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">units ◆  ·  calls ◯</text>
        </svg>
      );
    default: // p2p / A*
      return (
        <svg viewBox="0 0 300 150" style={box}>
          <path d="M60 75 Q60 35 120 35 Q95 55 120 75 Q95 95 120 115 Q60 115 60 75Z" fill={acc} opacity="0.16" stroke={acc} strokeWidth="1.5" />
          <circle cx="60" cy="75" r="6" fill={start} />
          <circle cx="240" cy="75" r="6" fill={end} />
          <line x1="120" y1="75" x2="234" y2="75" stroke={muted} strokeWidth="1.5" strokeDasharray="3 5" />
          <text x="175" y="68" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">h(n)</text>
          <text x="60" y="135" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">start</text>
          <text x="240" y="135" fill={muted} fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">target</text>
        </svg>
      );
  }
}

export function InfoDrawer() {
  const open = useStore((s) => s.infoOpen);
  const mode = useStore((s) => s.mode);
  const toggle = useStore((s) => s.toggleInfo);
  if (!open) return null;
  const info = INFO[mode];

  return (
    <div className="drawer">
      <div className="drawer-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: "var(--fs-md)", fontWeight: 700 }}>{info.title}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-micro)", color: "var(--ink-faint)" }}>
            {info.algo} · {info.complexity}
          </span>
        </div>
        <button className="drawer-close" onClick={toggle}>
          ×
        </button>
      </div>

      <div className="info-diagram">
        <Diagram mode={mode} />
      </div>

      <div className="cap" style={{ marginBottom: 8 }}>THE IDEA</div>
      <p className="info-p">{info.idea}</p>

      <div className="cap" style={{ margin: "18px 0 8px" }}>HOW IT RUNS</div>
      <ol className="info-steps">
        {info.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <div className="info-note">{info.note}</div>
    </div>
  );
}
