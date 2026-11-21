// SOLMARA — random: a tiny seeded RNG so the city, traffic and staged
// screenshots are identical every run for the same seed.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function random() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function rangeInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
