/**
 * Binary min-heap with decrease-key, specialised for integer items (node ids)
 * keyed by a float cost. Backs Dijkstra and A*.
 *
 * `pos[item]` holds the item's index in the heap (or -1 if absent), which is
 * what makes decrease-key O(log n) instead of a linear scan. This is the
 * priority-queue data structure called out in the DS&A inventory.
 */
export class MinHeap {
  private items: Int32Array;
  private keys: Float64Array;
  private pos: Int32Array;
  private n = 0;

  constructor(capacity: number) {
    this.items = new Int32Array(capacity);
    this.keys = new Float64Array(capacity);
    this.pos = new Int32Array(capacity).fill(-1);
  }

  get size(): number {
    return this.n;
  }

  has(item: number): boolean {
    return this.pos[item] !== -1;
  }

  keyOf(item: number): number {
    const p = this.pos[item];
    return p === -1 ? Infinity : this.keys[p];
  }

  /** Insert, or decrease the key if the item is already present. */
  push(item: number, key: number): void {
    const p = this.pos[item];
    if (p !== -1) {
      if (key < this.keys[p]) {
        this.keys[p] = key;
        this.siftUp(p);
      }
      return;
    }
    const i = this.n++;
    this.items[i] = item;
    this.keys[i] = key;
    this.pos[item] = i;
    this.siftUp(i);
  }

  /** Remove and return the minimum item (-1 if empty). */
  pop(): number {
    if (this.n === 0) return -1;
    const top = this.items[0];
    this.pos[top] = -1;
    this.n--;
    if (this.n > 0) {
      this.items[0] = this.items[this.n];
      this.keys[0] = this.keys[this.n];
      this.pos[this.items[0]] = 0;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(i: number): void {
    const { items, keys, pos } = this;
    const item = items[i];
    const key = keys[i];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      items[i] = items[parent];
      keys[i] = keys[parent];
      pos[items[i]] = i;
      i = parent;
    }
    items[i] = item;
    keys[i] = key;
    pos[item] = i;
  }

  private siftDown(i: number): void {
    const { items, keys, pos, n } = this;
    const item = items[i];
    const key = keys[i];
    const half = n >> 1;
    while (i < half) {
      let child = 2 * i + 1;
      const right = child + 1;
      if (right < n && keys[right] < keys[child]) child = right;
      if (keys[child] >= key) break;
      items[i] = items[child];
      keys[i] = keys[child];
      pos[items[i]] = i;
      i = child;
    }
    items[i] = item;
    keys[i] = key;
    pos[item] = i;
  }
}
