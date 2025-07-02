export type Grouped<T> = {
  key: string;
  items: T[];
};

export function groupBy<T>(array: T[], keySelector: (item: T) => string): Grouped<T>[] {
  const map = new Map<string, T[]>();

  for (const item of array) {
    const key = keySelector(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  const result: Grouped<T>[] = [];
  for (const [key, items] of map.entries()) {
    result.push({ key, items });
  }

  return result;
}
