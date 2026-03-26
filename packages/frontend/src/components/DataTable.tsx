import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableProps<T> {
  columns: {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
  }[];
  data: T[];
  loading?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  onNextPage,
  onPrevPage,
  hasNextPage,
  hasPrevPage,
}: DataTableProps<T>) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-6 py-4 text-xs uppercase tracking-wider font-semibold text-muted-foreground ${col.className}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading
              ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((item, i) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={i}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {columns.map((col, j) => (
                      <td key={j} className={`px-6 py-4 text-sm ${col.className}`}>
                        {typeof col.accessor === 'function'
                          ? col.accessor(item)
                          : (item[col.accessor] as React.ReactNode)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/10">
        <p className="text-sm text-muted-foreground">Showing {data.length} results</p>
        <div className="flex gap-2">
          <button
            disabled={!hasPrevPage || loading}
            onClick={onPrevPage}
            className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            disabled={!hasNextPage || loading}
            onClick={onNextPage}
            className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
