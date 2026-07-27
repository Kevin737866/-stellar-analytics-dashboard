import React from 'react';

interface SortableHeaderProps {
  field: string;
  label: string;
  sortEntries: { field: string; direction: 'ASC' | 'DESC' }[];
  onSort: (field: string, multi?: boolean) => void;
  className?: string;
}

export function SortableHeader({
  field,
  label,
  sortEntries,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const sortIndex = sortEntries.findIndex((e) => e.field === field);
  const isActive = sortIndex >= 0;
  const direction = isActive ? sortEntries[sortIndex].direction : null;
  const multiLabel = sortEntries.length > 1 ? ` (${sortIndex + 1}/${sortEntries.length})` : '';

  return (
    <th
      className={`cursor-pointer select-none hover:text-foreground ${className}`}
      onClick={(e) => onSort(field, e.shiftKey)}
    >
      {label}
      {isActive && (
        <span className="ml-1">
          {direction === 'ASC' ? '\u2191' : '\u2193'}
          {multiLabel}
        </span>
      )}
    </th>
  );
}
