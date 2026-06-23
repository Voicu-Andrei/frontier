import { describe, it, expect } from "vitest";
import { MinHeap } from "../heap";

describe("MinHeap", () => {
  it("returns items ordered by key", () => {
    const h = new MinHeap(16);
    // item id i has key = keys[i]
    const keys = [5, 1, 9, 3, 7, 2, 8, 0, 4, 6];
    keys.forEach((k, i) => h.push(i, k));
    const popped: number[] = [];
    while (h.size > 0) popped.push(h.pop());
    const expected = keys.map((k, i) => [k, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
    expect(popped).toEqual(expected);
  });

  it("supports decrease-key", () => {
    const h = new MinHeap(8);
    h.push(0, 10);
    h.push(1, 5);
    h.push(2, 8);
    h.push(1, 2); // decrease key of item 1
    expect(h.keyOf(1)).toBe(2);
    expect(h.pop()).toBe(1);
    expect(h.pop()).toBe(2);
    expect(h.pop()).toBe(0);
  });

  it("ignores an increase via push", () => {
    const h = new MinHeap(8);
    h.push(0, 3);
    h.push(0, 9); // should not raise the key
    expect(h.keyOf(0)).toBe(3);
  });

  it("reports presence and empties to -1", () => {
    const h = new MinHeap(4);
    h.push(2, 1);
    expect(h.has(2)).toBe(true);
    expect(h.has(3)).toBe(false);
    expect(h.pop()).toBe(2);
    expect(h.has(2)).toBe(false);
    expect(h.pop()).toBe(-1);
  });
});
