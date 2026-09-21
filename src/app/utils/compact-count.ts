export function compactCount(value: number | null | undefined): string {
  const count = Math.max(0, Number(value) || 0);
  const roundedThousands = Math.round(count / 100) / 10;
  if (count >= 1_000_000 || roundedThousands >= 1000) {
    return `${Number((count / 1_000_000).toFixed(1))}M`;
  }
  if (count >= 1000) return `${roundedThousands}K`;
  return String(count);
}
