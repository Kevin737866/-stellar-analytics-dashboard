import { useState, useCallback, useMemo } from 'react';

export interface SortEntry {
  field: string;
  direction: 'ASC' | 'DESC';
}

export type SortState = SortEntry;

export function useFilterSort(searchParams: URLSearchParams) {
  const sortEntries = useMemo<SortEntry[]>(() => {
    const entries: SortEntry[] = [];
    let i = 0;
    while (true) {
      const field = searchParams.get(`sort${i}Field`);
      const dir = searchParams.get(`sort${i}Dir`);
      if (!field || !dir) break;
      entries.push({ field, direction: dir as 'ASC' | 'DESC' });
      i++;
    }
    if (entries.length === 0) {
      entries.push({ field: 'createdAt', direction: 'DESC' });
    }
    return entries;
  }, [searchParams]);

  const primarySort = sortEntries[0] || { field: 'createdAt', direction: 'DESC' as const };

  const handleSort = useCallback(
    (field: string, multi?: boolean) => {
      const current = sortEntries;
      let next: SortEntry[];

      if (multi) {
        const existingIdx = current.findIndex((e) => e.field === field);
        if (existingIdx >= 0) {
          const existing = current[existingIdx];
          if (existing.direction === 'ASC') {
            next = current.map((e, i) =>
              i === existingIdx ? { ...e, direction: 'DESC' as const } : e
            );
          } else {
            next = current.filter((_, i) => i !== existingIdx);
            if (next.length === 0) next.push({ field: 'createdAt', direction: 'DESC' });
          }
        } else {
          next = [...current, { field, direction: 'ASC' as const }];
          if (next.length > 5) next = next.slice(-5);
        }
      } else {
        if (current.length === 1 && current[0].field === field) {
          if (current[0].direction === 'ASC') {
            next = [{ field, direction: 'DESC' }];
          } else {
            next = [{ field, direction: 'ASC' }];
          }
        } else {
          next = [{ field, direction: 'ASC' }];
        }
      }

      const params = new URLSearchParams(searchParams);
      for (const key of Array.from(params.keys())) {
        if (key.startsWith('sort')) params.delete(key);
      }
      next.forEach((entry, i) => {
        params.set(`sort${i}Field`, entry.field);
        params.set(`sort${i}Dir`, entry.direction);
      });
      window.history.pushState({}, '', `?${params.toString()}`);
    },
    [sortEntries, searchParams]
  );

  return {
    sortEntries,
    sort: primarySort,
    handleSort,
  };
}
