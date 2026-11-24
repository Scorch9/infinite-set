export const deck = Array.from({length: 81}, (_, id) => id);
export const features = deck.map(id => [1, 3, 9, 27].map(place => Math.floor(id / place) % 3));
const third = deck.map(a => deck.map(b => features[a].reduce((id, v, i) =>
  id + ((6 - v - features[b][i]) % 3) * 3 ** i, 0)));

export function solutions(cards) {
  const present = new Set(cards);
  const result = [];
  for (const a of cards) for (const b of cards) {
    if (a >= b) continue;
    const c = third[a][b];
    if (c > b && present.has(c)) result.push([a, b, c]);
  }
  return result;
}

export function validate({rows, columns, min, max}) {
  if (![rows, columns].every(n => Number.isInteger(n) && n >= 2 && n <= 5)) return 'Choose between two and five rows and columns.';
  if (![min, max].every(n => Number.isSafeInteger(n) && n >= 0) || min > max) return 'Enter whole-number limits with the minimum at or below the maximum.';
  const n = rows * columns;
  const bound = Math.floor(n * Math.floor((n - 1) / 2) / 3);
  if (min > bound) return 'A board this size can contain at most ' + bound + ' sets. Lower the minimum or enlarge the board.';
  return '';
}

export function generate(options, budget = 2200) {
  const error = validate(options);
  if (error) throw Error(error);
  const {rows, columns, min, max} = options;
  const size = rows * columns;
  const distance = count => Math.max(0, min - count, count - max);
  const end = performance.now() + budget;
  while (performance.now() < end) {
    const pool = [...deck];
    for (let i = 0; i < size; i++) {
      const j = i + Math.floor(Math.random() * (81 - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let score = Infinity;
    for (let step = 0; step < 400; step++) {
      const i = Math.floor(Math.random() * size);
      const j = size + Math.floor(Math.random() * (81 - size));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      const cards = pool.slice(0, size);
      const sets = solutions(cards);
      const next = distance(sets.length);
      if (!next) return {cards, sets};
      if (next <= score) score = next;
      else [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }
  throw Error('No matching deal found in time. Try again or widen the range.');
}