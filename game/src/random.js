// A small seeded random generator (mulberry32) plus the few helpers the city builder
// and the world simulation use. Same seed, same city, same traffic: the screenshots
// and the playtest are reproducible from `?seed=N`.
export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of `list`. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** True with probability `p`. */
    chance(p) {
      return next() < p;
    },
  };
}
