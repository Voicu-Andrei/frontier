# RouteLab — What Each Tab Does (Plain English)

---

## How the app works in general

The city is modelled as a network of dots and lines. Every **junction** where roads meet is a dot (called a node). Every **road** between two junctions is a line (called an edge). Each road knows two things: how long it is, and how long it takes to drive.

The app has a search engine that figures out the best way to get from one place to another. It does this by starting at the source, looking at all the neighbouring junctions, picking the cheapest one to go to next, and repeating — always picking the cheapest option still on the table — until it reaches the destination. When it's done, it retraces its steps to give you the actual route.

All eight tabs use this same engine. What changes is *what question you're asking it*.

---

## Tab 1 — Point (A to B routing)

**What it does:** You click two points on the map. The app finds the fastest (or shortest) road route between them.

**How it works — the simple version:**

Imagine you're looking for your keys in a park. A drunk person would search randomly in all directions. A sober person would think "I probably left them near the bench" and walk roughly toward it.

Plain Dijkstra (the baseline algorithm) is the drunk person — it expands outward in every direction equally, like a ripple in a pond. It'll find the answer, but it looks at a lot of streets it never needed to check.

**A\*** (the algorithm this tab uses) is the sober person. It has a built-in compass: at every step it picks the junction that looks most promising — the one that's both cheap to reach *and* close to the destination. It ignores most of the city and heads roughly straight there.

The result is always the same correct route. A\* just gets there while looking at far fewer streets.

---

## Tab 2 — Bidir (Search from both ends)

**What it does:** Same goal as Tab 1 — find the route from A to B — but it uses a smarter strategy.

**How it works — the simple version:**

Imagine digging a tunnel through a mountain. You could dig from one side all the way through — or you could start two teams, one from each side, and have them meet in the middle. The total digging is much less.

Bidirectional search does exactly this. One search starts at A and expands forward. Another starts at B and expands backward. When they meet, the route is stitched together.

**The pizza story:** One search covers a circle of radius *d*. Two searches each cover a circle of radius *d/2*. Because area grows with radius *squared*, two half-circles cover only *half* the total area of one full circle — so together they explore about half as many streets. It's the same reason two 12-inch pizzas give you less pizza than one 18-inch one (226 in² vs 254 in²).

There's one tricky part: you can't just stop the moment the two searches touch each other. They might have touched at a bad spot. You need a special rule (called μ) to know when you're *sure* you've found the best meeting point. Once that's confirmed, you stitch the two halves into a single path.

---

## Tab 3 — Race (Dijkstra vs A\*)

**What it does:** Runs *both* algorithms side-by-side on the exact same route and measures how much work each one does.

**How it works — the simple version:**

The left panel runs Dijkstra, the right panel runs A\*. Both find the identical route — the coloured line on screen is the same in both panels. What's different is the *blue cloud* of streets each one explored before finding it.

Dijkstra's cloud is a big full circle. A\*'s cloud is a narrow teardrop aimed at the destination. The bar chart below counts how many junctions each algorithm had to visit.

This tab is a live benchmark. The speedup shown isn't claimed — it's measured right in front of you.

---

## Tab 4 — Iso (Reachability zone)

**What it does:** You pick a starting point and a time budget (e.g. 20 minutes). The app colours every street you can reach within that time and draws a boundary around the whole area.

**How it works — the simple version:**

Imagine dropping ink at the starting point. The ink spreads outward — but it flows *faster* along motorways and *slower* through backstreets. After your time budget runs out, every street the ink touched is coloured.

The shape you see is called an **isochrone** (Greek for "same time"). It's almost never a circle. It bulges out along fast roads and contracts through slow neighbourhoods. It can't cross a river without a bridge.

The three colour bands show how quickly you can reach different areas: the innermost colour is streets reachable in the first third of your budget, the middle band is the second third, and the outer band is everything up to the full limit.

**Real-world example:** Every property listing on Rightmove or Zillow draws a circular "10-minute walk zone". That circle is a lie — it ignores roads, rivers, and dead ends. The blob on this tab shows the real shape.

---

## Tab 5 — Multi (Visit several stops)

**What it does:** You drop several stops on the map. The app finds a short route that visits all of them.

**How it works — the simple version:**

This is the classic Travelling Salesman Problem — the same puzzle delivery drivers face when planning a route with multiple drop-offs. The goal is to visit every stop without backtracking more than necessary.

The brutal fact: with 10 stops there are about 180,000 possible orders to visit them. With 20 stops there are 60 *quadrillion*. Even a computer checking a billion options per second would need two years to check all 20-stop routes. So you can't try everything.

The approach here: first calculate how long it takes to drive between every pair of stops (using the routing engine). Then use a simple greedy rule — always go to the nearest unvisited stop next. It's not guaranteed to be perfect, but it's fast and usually very good.

The route shown is marked **OPT\*** to signal that it's a good approximation, not the provably optimal answer.

---

## Tab 6 — Alt (Alternative routes)

**What it does:** Instead of one route from A to B, it finds three genuinely different options.

**How it works — the simple version:**

You know how Google Maps always shows you three route choices? They're never three versions of the same road — they're three clearly different paths you'd actually consider taking.

Getting those distinct options isn't obvious. The three *mathematically* shortest paths are almost always the same road with one block swapped — completely useless as "alternatives."

The trick used here (called the **penalty method**) works like this:

1. Find the best route.
2. Pretend every road on that route just got more expensive — multiply its cost by a penalty factor.
3. Search again. The algorithm is now forced to avoid those roads and take a genuinely different path.
4. Repeat once more for the third option.

The costs displayed are the real travel times, not the inflated ones — the inflation is just used to push the router off the path it already found.

---

## Tab 7 — Cordon (Block a zone)

**What it does:** You mark a zone on the map. The app finds the *fewest* roads you'd need to block so that nothing inside the zone can get out.

**How it works — the simple version:**

Think of a medieval city. It has walls everywhere, but only a handful of gates. To seal the city you don't rebuild the walls — you just close the gates. The question is: which roads are the "gates" of a given zone?

This is called the **minimum cut** problem. The app figures it out using a clever theorem:

Imagine every road is a water pipe with a capacity of 1 litre per second. You pump water from inside the zone toward the outside. You keep pumping until no more water can flow — every possible path is completely blocked by full pipes. The pipes that are full at that moment are exactly the roads you need to block. The maximum water flow equals the minimum number of roads to cut.

**Why it works so well on real cities:** Rivers and other natural barriers force all traffic through a small number of bridges. On Munich's map, sealing one riverbank typically requires blocking just 2-3 bridges — not every road along the perimeter.

---

## Tab 8 — Dispatch (Nearest unit assignment)

**What it does:** You place several "units" on the map (like ambulances or fire stations). You then drop a call somewhere, and the app instantly shows which unit is closest *by road* and routes it there.

**How it works — the simple version:**

Naive approach: run a separate route search from every unit to the call location. If you have 5 units, that's 5 searches.

**Multi-source Dijkstra** does it in one. You start the search simultaneously from *all* units at once, all with a starting cost of zero. The frontiers spread outward and compete. The first frontier to reach any street "claims" it — meaning that unit is the closest to anything on that street.

The result is a map divided into territories, one per unit. Every possible call location already has a pre-computed answer: the unit whose territory it falls in. It's the road-network equivalent of a Voronoi diagram — those maps that show which post office / hospital / fire station is nearest to any given point.

When you drop a call, the app just checks which territory it landed in and routes the right unit.

---

## Quick reference

| Tab | Question | Algorithm |
|-----|----------|-----------|
| **Point** | Fastest route A → B | A\* (guided search) |
| **Bidir** | Same, but smarter | Bidirectional Dijkstra |
| **Race** | How much does the guidance help? | Dijkstra vs A\* side-by-side |
| **Iso** | How far can I get in N minutes? | Bounded Dijkstra (no target) |
| **Multi** | Shortest tour through several stops | Nearest-neighbour TSP heuristic |
| **Alt** | Give me 3 genuinely different routes | Penalty method |
| **Cordon** | Fewest roads to seal a zone | Max-flow / min-cut (Dinic's) |
| **Dispatch** | Which unit gets there first? | Multi-source Dijkstra |
