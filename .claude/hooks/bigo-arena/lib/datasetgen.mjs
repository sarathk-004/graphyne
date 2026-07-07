// Synthetic input generator for benchmarkable functions. We don't know
// the real element shape (interfaces live elsewhere and aren't resolved
// here), so we generate generic records covering common field names —
// good enough to exercise iteration/lookup patterns without the
// function crashing on a missing property it expects.

export function generateArrayInput(n, seed = 42) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const items = [];
  const uniqueCount = Math.max(1, Math.floor(n * 0.85));
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rand() * uniqueCount);
    items.push({
      id: idx,
      email: `user${idx}@example.com`,
      name: `User ${idx}`,
      value: idx,
      label: `item-${idx}`,
      count: idx % 10,
    });
  }
  return items;
}
