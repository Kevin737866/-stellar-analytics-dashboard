import React from 'react';
import { SortableHeader } from './SortableHeader';

export interface SortEntry {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortEntries: SortEntry[];
  onSort: (field: string, multi?: boolean) => void;
  keyExtractor: (row: T) => string;
  loading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  sortEntries,
  onSort,
  keyExtractor,
  loading = false,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {columns.map((col) =>
              col.sortable ? (
                <SortableHeader
                  key={col.key}
                  field={col.key}
                  label={col.header}
                  sortEntries={sortEntries}
                  onSort={onSort}
                />
              ) : (
                <th key={col.key}>{col.header}</th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={keyExtractor(row)} className="border-t">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
