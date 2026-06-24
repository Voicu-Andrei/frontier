import { useStore } from "../state/store";
import type { Mode } from "../state/scene";

type DiagramKind =
  | "compass"
  | "heuristic"
  | "ripple"
  | "heap"
  | "tunnel"
  | "balls"
  | "sideBySide"
  | "ink"
  | "bands"
  | "tour"
  | "factorial"
  | "stations"
  | "multisource"
  | "altroutes"
  | "spur"
  | "backpointers"
  | "flow"
  | "mincut";

// Shown on EVERY tab — the key thing to understand about the whole app.
const SHARED: Section = {
  heading: "SCAN FIRST, THEN REPLAY",
  body: "Important: the search finishes in an instant. As it runs we record the order nodes were settled and a 'came-from' pointer on each. The animation you watch is a REPLAY of that recording — which is why the route, the meeting point, or a unit's assignment can be shown: they were already discovered when the scan completed. Nothing aims ahead of time; the path is rebuilt by walking the came-from pointers back from the destination.",
  diagram: "backpointers",
};

interface Section {
  heading: string;
  body: string;
  diagram: DiagramKind;
}

interface Info {
  title: string;
  algo: string;
  complexity: string;
  sections: Section[];
}

const INFO: Record<Mode, Info> = {
  p2p: {
    title: "Point-to-point routing",
    algo: "A* search",
    complexity: "O((V + E) log V)",
    sections: [
      {
        heading: "THE IDEA — A COMPASS",
        body: "Dijkstra explores in every direction equally. A* adds a compass: at each step it prefers nodes that look closer to the destination, so it heads roughly straight there instead of wandering.",
        diagram: "compass",
      },
      {
        heading: "THE HEURISTIC h(n)",
        body: "The compass is a heuristic: the straight-line distance from a node to the target (÷ top speed for time). It's an optimistic guess — the real road is never shorter — which is exactly what keeps the answer correct.",
        diagram: "heuristic",
      },
      {
        heading: "HOW IT RUNS",
        body: "Priority = g(n) + h(n): cost so far plus the guess. A binary heap always hands back the most promising node next; we settle it, relax its neighbours, and stop the instant the target is settled.",
        diagram: "heap",
      },
      {
        heading: "WHY IT'S OPTIMAL",
        body: "Because the guess never overestimates, the first time the target comes off the heap its cost is provably the shortest — verified against plain Dijkstra in the tests.",
        diagram: "ripple",
      },
    ],
  },
  bidir: {
    title: "Bidirectional search",
    algo: "Bidirectional Dijkstra",
    complexity: "O((V + E) log V), ~½ the nodes",
    sections: [
      {
        heading: "TWO DIGGERS, ONE TUNNEL",
        body: "Like digging a tunnel from both ends at once: one search grows from the start, another from the destination (over the reversed graph). They only have to reach halfway before they meet.",
        diagram: "tunnel",
      },
      {
        heading: "WHY IT'S FASTER",
        body: "A single search settles one big disc of radius d. Two searches settle two discs of radius d⁄2 — together far smaller in area, so far fewer nodes are touched.",
        diagram: "balls",
      },
      {
        heading: "WHEN THEY MEET",
        body: "Each time the frontiers touch we record the best start→meet→end cost μ. Once the two cheapest frontier nodes sum to ≥ μ, nothing shorter can exist, so we stop and stitch the two halves into one path.",
        diagram: "tunnel",
      },
    ],
  },
  race: {
    title: "Race / benchmark",
    algo: "Dijkstra vs A*",
    complexity: "same big-O, different constants",
    sections: [
      {
        heading: "SAME ROUTE, DIFFERENT WORK",
        body: "Both algorithms return the EXACT same shortest route — so the line is identical in both panes. What differs is how much of the map each one explores to find it.",
        diagram: "sideBySide",
      },
      {
        heading: "WHAT YOU'RE SEEING",
        body: "Left: Dijkstra floods outward as a full circle. Right: A* pushes a narrow beam toward the target. The bars count nodes explored and runtime — the speedup is the ratio, measured, not claimed.",
        diagram: "ripple",
      },
    ],
  },
  iso: {
    title: "Isochrone — reachability",
    algo: "Bounded Dijkstra",
    complexity: "O((V + E) log V)",
    sections: [
      {
        heading: "INK ON A MAP",
        body: "“How far can I get in N minutes?” Imagine ink spreading from the origin, but flowing faster along fast roads. Run Dijkstra with a time budget and no target — every street it reaches in time is reachable.",
        diagram: "ink",
      },
      {
        heading: "WHY IT'S NOT A CIRCLE",
        body: "Speed matters: in 10 minutes you travel far along a motorway but only a few blocks through side streets. So the reachable shape stretches along arterials and pulls in elsewhere — never a clean circle.",
        diagram: "bands",
      },
      {
        heading: "THE COLOUR BANDS",
        body: "Streets are tinted by arrival time: yellow ≤ ⅓ of the budget, pink ≤ ⅔, violet ≤ the full budget. A concave outline wraps the whole reachable area so it follows the roads, not the empty fields.",
        diagram: "bands",
      },
    ],
  },
  multi: {
    title: "Multi-stop routing",
    algo: "TSP · nearest-neighbour",
    complexity: "NP-hard; heuristic here",
    sections: [
      {
        heading: "THE ERRAND RUN",
        body: "You have several stops and want the shortest loop that visits them all — the Travelling Salesman Problem. Picture planning errands so you backtrack as little as possible.",
        diagram: "tour",
      },
      {
        heading: "WHY IT'S HARD",
        body: "The number of possible orders explodes: 10 stops already have ~180,000 distinct tours, 15 stops have billions. No known algorithm solves it quickly for large n — it's NP-hard.",
        diagram: "factorial",
      },
      {
        heading: "OUR APPROACH",
        body: "We build an all-pairs cost matrix with the routing engine, then greedily hop to the nearest unvisited stop and route the real roads between them. Fast and usually good — marked OPT* because it isn't guaranteed perfect.",
        diagram: "tour",
      },
    ],
  },
  alt: {
    title: "Alternative routes",
    algo: "Penalty method (k routes)",
    complexity: "O(K · (E + V log V))",
    sections: [
      {
        heading: "MORE THAN ONE GOOD WAY",
        body: "There's rarely a single sensible route — usually a few are within a minute or two. Alt offers genuinely distinct options so you can pick by preference, avoid a road, or keep a backup.",
        diagram: "altroutes",
      },
      {
        heading: "HOW — MAKE BUSY ROADS COSTLY",
        body: "Find the best route. Then multiply the cost of every road it used and search again — now the cheapest path is forced to detour around them. Repeat for each alternative. (The exact k-shortest-paths algorithm, Yen's, is also implemented; the penalty method just gives more visibly different routes, like consumer maps do.)",
        diagram: "spur",
      },
    ],
  },
  cut: {
    title: "Containment — min cut",
    algo: "Max-flow / min-cut (Dinic)",
    complexity: "O(V² E)",
    sections: [
      {
        heading: "SEAL THE ZONE",
        body: "Given an area to contain, what's the FEWEST roads to block so nothing inside can escape to the rest of the map? Cutting every road on the perimeter works but is wasteful — the goal is the minimum set.",
        diagram: "mincut",
      },
      {
        heading: "MAX-FLOW = MIN-CUT",
        body: "Treat roads as pipes (capacity 1 each). Push as much 'flow' as possible from the zone to the outside. A beautiful theorem says the maximum flow exactly equals the minimum cut — so once flow is maxed, the saturated bottleneck roads ARE the cheapest set to block.",
        diagram: "flow",
      },
      {
        heading: "WHY IT FINDS CHOKEPOINTS",
        body: "The cut naturally lands on bottlenecks. On real Munich that means bridges: roads only cross the Isar at a handful of points, so sealing one bank needs just those few cuts — not a wall around the whole zone.",
        diagram: "mincut",
      },
    ],
  },
  dispatch: {
    title: "Nearest-unit dispatch",
    algo: "Multi-source Dijkstra",
    complexity: "O((V + E) log V)",
    sections: [
      {
        heading: "WHICH STATION IS CLOSEST?",
        body: "Several units are on the map; every incoming call should go to whichever can reach it first by road (not by straight line). Think fire stations carving up a city into response zones.",
        diagram: "stations",
      },
      {
        heading: "ONE SEARCH, MANY SOURCES",
        body: "Instead of one search per unit, seed Dijkstra with all units at distance 0 at once. The frontiers compete; each street is claimed by whichever unit reaches it first. A call's nearest unit is just whose territory it lands in.",
        diagram: "multisource",
      },
    ],
  },
};

const box = { width: "100%", height: 116, display: "block" } as const;

function MiniDiagram({ kind }: { kind: DiagramKind }) {
  const acc = "var(--accent)";
  const muted = "var(--ink-faint)";
  const w1 = "var(--frontier-wave-1)";
  const w2 = "var(--frontier-wave-2)";
  const algb = "var(--algo-b)";
  const end = "var(--end)";
  const start = "var(--start)";
  const mono = "var(--font-mono)";

  switch (kind) {
    case "compass":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <path d="M60 58 Q60 28 110 28 Q88 43 110 58 Q88 73 110 88 Q60 88 60 58Z" fill={acc} opacity="0.18" stroke={acc} strokeWidth="1.3" />
          <line x1="70" y1="58" x2="232" y2="58" stroke={muted} strokeWidth="1.2" strokeDasharray="3 5" />
          <path d="M210 50 L236 58 L210 66" fill="none" stroke={acc} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="60" cy="58" r="5" fill={start} />
          <circle cx="240" cy="58" r="5" fill={end} />
          <text x="150" y="50" fill={muted} fontSize="10" textAnchor="middle" fontFamily={mono}>aim at target</text>
        </svg>
      );
    case "heuristic":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <path d="M55 80 Q110 30 150 70 Q190 100 245 45" fill="none" stroke={acc} strokeWidth="2.4" />
          <line x1="55" y1="80" x2="245" y2="45" stroke={muted} strokeWidth="1.4" strokeDasharray="4 4" />
          <circle cx="55" cy="80" r="5" fill={start} />
          <circle cx="245" cy="45" r="5" fill={end} />
          <text x="150" y="98" fill={acc} fontSize="10" textAnchor="middle" fontFamily={mono}>g(n): real road</text>
          <text x="150" y="38" fill={muted} fontSize="10" textAnchor="middle" fontFamily={mono}>h(n): straight-line guess</text>
        </svg>
      );
    case "ripple":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          {[42, 32, 22, 12].map((r, i) => (
            <circle key={i} cx="150" cy="58" r={r} fill="none" stroke={i === 0 ? muted : w1} strokeWidth="1.3" opacity={0.4 + i * 0.15} />
          ))}
          <circle cx="150" cy="58" r="5" fill={start} />
        </svg>
      );
    case "heap":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <line x1="150" y1="32" x2="100" y2="64" stroke={muted} strokeWidth="1.2" />
          <line x1="150" y1="32" x2="200" y2="64" stroke={muted} strokeWidth="1.2" />
          <line x1="100" y1="64" x2="74" y2="94" stroke={muted} strokeWidth="1.2" />
          <line x1="100" y1="64" x2="126" y2="94" stroke={muted} strokeWidth="1.2" />
          <line x1="200" y1="64" x2="174" y2="94" stroke={muted} strokeWidth="1.2" />
          {[[150, 32, "2", acc], [100, 64, "5", muted], [200, 64, "7", muted], [74, 94, "9", muted], [126, 94, "8", muted], [174, 94, "6", muted]].map(([x, y, t, c], i) => (
            <g key={i}>
              <circle cx={x as number} cy={y as number} r="11" fill="var(--panel-solid)" stroke={c as string} strokeWidth="1.5" />
              <text x={x as number} y={(y as number) + 4} fill="var(--ink)" fontSize="11" textAnchor="middle" fontFamily={mono} fontWeight="600">{t as string}</text>
            </g>
          ))}
          <text x="245" y="36" fill={acc} fontSize="9" textAnchor="middle" fontFamily={mono}>min first</text>
        </svg>
      );
    case "tunnel":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <path d="M30 58 L120 58" stroke={start} strokeWidth="3" strokeLinecap="round" />
          <path d="M105 50 L122 58 L105 66" fill="none" stroke={start} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M270 58 L180 58" stroke={end} strokeWidth="3" strokeLinecap="round" />
          <path d="M195 50 L178 58 L195 66" fill="none" stroke={end} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="144" y="52" width="12" height="12" rx="2" fill={w2} transform="rotate(45 150 58)" />
          <circle cx="30" cy="58" r="5" fill={start} />
          <circle cx="270" cy="58" r="5" fill={end} />
          <text x="150" y="92" fill={muted} fontSize="10" textAnchor="middle" fontFamily={mono}>meet in the middle</text>
        </svg>
      );
    case "balls":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <circle cx="78" cy="58" r="40" fill={muted} opacity="0.16" stroke={muted} strokeWidth="1.2" />
          <circle cx="78" cy="58" r="4" fill={start} />
          <text x="78" y="110" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>1 search</text>
          <circle cx="190" cy="58" r="22" fill={acc} opacity="0.18" stroke={acc} strokeWidth="1.2" />
          <circle cx="234" cy="58" r="22" fill={w1} opacity="0.18" stroke={w1} strokeWidth="1.2" />
          <circle cx="190" cy="58" r="4" fill={start} />
          <circle cx="234" cy="58" r="4" fill={end} />
          <text x="212" y="110" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>2 half-searches</text>
        </svg>
      );
    case "sideBySide":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <circle cx="72" cy="52" r="40" fill={acc} opacity="0.14" />
          <line x1="72" y1="52" x2="104" y2="30" stroke="var(--route-a)" strokeWidth="2.4" />
          <circle cx="72" cy="52" r="4" fill={start} /><circle cx="104" cy="30" r="4" fill={end} />
          <text x="72" y="108" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>Dijkstra</text>
          <path d="M196 52 Q196 30 228 30 Q210 41 228 52 Q210 63 228 74 Q196 74 196 52Z" fill={w1} opacity="0.2" />
          <line x1="196" y1="52" x2="228" y2="30" stroke="var(--route-a)" strokeWidth="2.4" />
          <circle cx="196" cy="52" r="4" fill={start} /><circle cx="228" cy="30" r="4" fill={end} />
          <text x="214" y="108" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>A* — same line</text>
        </svg>
      );
    case "ink":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <line x1="40" y1="64" x2="270" y2="40" stroke={muted} strokeWidth="3" opacity="0.5" />
          <path d="M150 58 Q120 30 150 26 Q250 30 252 40 Q250 56 150 58Z" fill={w1} opacity="0.22" />
          <path d="M150 58 Q110 80 120 96 Q150 92 150 58Z" fill={w2} opacity="0.3" />
          <circle cx="150" cy="58" r="5" fill={start} />
          <text x="240" y="34" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>fast road</text>
        </svg>
      );
    case "bands":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <path d="M150 18 Q235 28 252 58 Q230 96 150 100 Q72 92 60 58 Q92 30 150 18Z" fill={algb} opacity="0.16" stroke={algb} strokeWidth="1.3" />
          <path d="M150 34 Q205 42 214 60 Q200 84 150 86 Q104 80 100 60 Q120 44 150 34Z" fill={w1} opacity="0.2" stroke={w1} strokeWidth="1.3" />
          <path d="M150 46 Q180 52 184 62 Q176 74 150 74 Q126 70 124 62 Q134 50 150 46Z" fill={w2} opacity="0.3" stroke={w2} strokeWidth="1.3" />
          <circle cx="150" cy="60" r="4" fill={start} />
          <text x="150" y="112" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>⅓ · ⅔ · full budget</text>
        </svg>
      );
    case "tour":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <polyline points="60,90 92,34 168,24 236,58 196,98 60,90" fill="none" stroke={acc} strokeWidth="2.2" strokeLinejoin="round" />
          {[[60, 90], [92, 34], [168, 24], [236, 58], [196, 98]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="7" fill={i === 0 ? start : acc} stroke="#fff" strokeWidth="1.6" />
              <text x={x} y={y + 3} fill="#fff" fontSize="9" textAnchor="middle" fontFamily={mono} fontWeight="700">{i === 0 ? "S" : i}</text>
            </g>
          ))}
        </svg>
      );
    case "factorial":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          {(() => {
            const pts = [[60, 30], [240, 36], [210, 96], [90, 92], [150, 20], [200, 60]];
            const lines = [];
            for (let i = 0; i < pts.length; i++)
              for (let j = i + 1; j < pts.length; j++)
                lines.push(<line key={`${i}-${j}`} x1={pts[i][0]} y1={pts[i][1]} x2={pts[j][0]} y2={pts[j][1]} stroke={muted} strokeWidth="0.7" opacity="0.5" />);
            return lines;
          })()}
          {[[60, 30], [240, 36], [210, 96], [90, 92], [150, 20], [200, 60]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill={w2} />
          ))}
          <text x="150" y="110" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>orders explode with n</text>
        </svg>
      );
    case "stations":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <path d="M0 0 L150 0 L120 116 L0 116Z" fill={acc} opacity="0.1" />
          <path d="M150 0 L300 0 L300 116 L120 116Z" fill={w1} opacity="0.1" />
          <line x1="135" y1="0" x2="105" y2="116" stroke={muted} strokeWidth="1" strokeDasharray="4 4" />
          <rect x="68" y="44" width="14" height="14" rx="2" fill={acc} transform="rotate(45 75 51)" />
          <rect x="208" y="58" width="14" height="14" rx="2" fill={acc} transform="rotate(45 215 65)" />
          <circle cx="150" cy="74" r="6" fill="none" stroke={end} strokeWidth="3" />
          <text x="150" y="108" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>response zones</text>
        </svg>
      );
    case "multisource":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <circle cx="80" cy="48" r="30" fill={acc} opacity="0.13" />
          <circle cx="210" cy="64" r="30" fill={w1} opacity="0.13" />
          <circle cx="150" cy="40" r="24" fill={algb} opacity="0.13" />
          <rect x="73" y="41" width="13" height="13" rx="2" fill={acc} transform="rotate(45 80 48)" />
          <rect x="203" y="57" width="13" height="13" rx="2" fill={acc} transform="rotate(45 210 64)" />
          <rect x="143" y="33" width="13" height="13" rx="2" fill={acc} transform="rotate(45 150 40)" />
          <text x="150" y="108" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>frontiers compete</text>
        </svg>
      );
    case "altroutes":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <path d="M50 58 Q150 18 250 58" fill="none" stroke="var(--route-a)" strokeWidth="2.6" />
          <path d="M50 58 Q150 58 250 58" fill="none" stroke={w2} strokeWidth="2.2" opacity="0.85" />
          <path d="M50 58 Q150 98 250 58" fill="none" stroke={algb} strokeWidth="2.2" opacity="0.85" />
          <circle cx="50" cy="58" r="5" fill={start} />
          <circle cx="250" cy="58" r="5" fill={end} />
          <text x="150" y="110" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>best + 2 alternatives</text>
        </svg>
      );
    case "spur":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <path d="M40 70 L120 70" stroke={muted} strokeWidth="2.2" />
          <line x1="84" y1="63" x2="98" y2="77" stroke={end} strokeWidth="2.4" strokeLinecap="round" />
          <line x1="98" y1="63" x2="84" y2="77" stroke={end} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M120 70 Q170 30 260 44" fill="none" stroke={w2} strokeWidth="2.4" strokeDasharray="5 4" />
          <circle cx="40" cy="70" r="5" fill={start} />
          <circle cx="120" cy="70" r="5" fill={acc} />
          <circle cx="260" cy="44" r="5" fill={end} />
          <text x="120" y="92" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>ban an edge, re-route</text>
        </svg>
      );
    case "flow":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <circle cx="34" cy="58" r="6" fill={start} />
          <circle cx="266" cy="58" r="6" fill={end} />
          <path d="M40 50 Q110 28 150 44" stroke={acc} strokeWidth="3" fill="none" opacity="0.5" />
          <path d="M40 66 Q110 88 150 72" stroke={acc} strokeWidth="3" fill="none" opacity="0.5" />
          <path d="M150 44 L150 72" stroke={w2} strokeWidth="3" />
          <path d="M150 44 Q210 30 260 52" stroke={acc} strokeWidth="3" fill="none" opacity="0.5" />
          <path d="M150 72 Q210 92 260 64" stroke={acc} strokeWidth="3" fill="none" opacity="0.5" />
          <line x1="150" y1="40" x2="150" y2="76" stroke={end} strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="150" y="100" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>bottleneck = min cut</text>
          <text x="34" y="40" fill={muted} fontSize="10" textAnchor="middle" fontFamily={mono}>in</text>
          <text x="266" y="40" fill={muted} fontSize="10" textAnchor="middle" fontFamily={mono}>out</text>
        </svg>
      );
    case "mincut":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          <path d="M70 30 Q150 14 200 40 Q210 80 150 96 Q80 90 64 60 Q60 42 70 30Z" fill={end} opacity="0.12" stroke={end} strokeWidth="1.4" />
          <circle cx="135" cy="56" r="5" fill={start} />
          {[[200, 40], [150, 96], [70, 30]].map(([x, y], i) => (
            <g key={i}>
              <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} stroke={end} strokeWidth="2.4" strokeLinecap="round" />
              <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} stroke={end} strokeWidth="2.4" strokeLinecap="round" />
            </g>
          ))}
          <text x="150" y="110" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>block the few key roads</text>
        </svg>
      );
    case "backpointers":
      return (
        <svg viewBox="0 0 300 116" style={box}>
          {[[50, 58], [110, 40], [170, 64], [230, 46]].map(([x, y], i, a) => (
            <g key={i}>
              {i > 0 && (
                <path
                  d={`M${x - 6} ${y} L${a[i - 1][0] + 6} ${a[i - 1][1]}`}
                  stroke={acc}
                  strokeWidth="1.6"
                  markerEnd=""
                  fill="none"
                />
              )}
              <circle cx={x} cy={y} r="9" fill="var(--panel-solid)" stroke={i === 0 ? start : i === a.length - 1 ? end : muted} strokeWidth="1.6" />
            </g>
          ))}
          <text x="150" y="104" fill={muted} fontSize="9" textAnchor="middle" fontFamily={mono}>each node → came-from → start</text>
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

      {[...info.sections, SHARED].map((s, i) => (
        <div key={i} className="info-section">
          <div className="cap" style={{ marginBottom: 8 }}>{s.heading}</div>
          <div className="info-diagram">
            <MiniDiagram kind={s.diagram} />
          </div>
          <p className="info-p">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
