/**
 * Export utility functions for CSV and JSON data export
 * Provides client-side export functionality with progress tracking
 */

export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  onProgress?: (progress: number) => void;
}

/**
 * Convert data to CSV format
 */
function arrayToCSV<T extends Record<string, any>>(data: T[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Handle null/undefined
      if (value === null || value === undefined) return '';
      // Handle objects/arrays (stringify)
      if (typeof value === 'object') return JSON.stringify(value);
      // Escape quotes and wrap in quotes if contains comma or quote
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Convert dashboard stats to flat array for export
 */
export function statsToArray(stats: any): Record<string, any>[] {
  return [{
    network: stats.network,
    totalLedgers: stats.totalLedgers,
    totalTransactions: stats.totalTransactions,
    totalOperations: stats.totalOperations,
    totalAccounts: stats.totalAccounts,
    totalAssets: stats.totalAssets,
    activeAccounts24h: stats.activeAccounts24h,
    volume24h: stats.volume24h,
    averageFee24h: stats.averageFee24h,
    successRate24h: stats.successRate24h,
    latestLedger: stats.latestLedger,
    latestLedgerTime: stats.latestLedgerTime,
    exportedAt: new Date().toISOString(),
  }];
}

/**
 * Export data as CSV
 */
export async function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  onProgress?.(10);
  
  const csv = arrayToCSV(data);
  onProgress?.(50);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  onProgress?.(80);
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  onProgress?.(100);
}

/**
 * Export data as JSON
 */
export async function exportToJSON<T extends Record<string, any>>(
  data: T[],
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  onProgress?.(10);
  
  const json = JSON.stringify(data, null, 2);
  onProgress?.(50);
  
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  onProgress?.(80);
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  onProgress?.(100);
}

/**
 * Main export function that handles both CSV and JSON formats
 */
export async function exportData<T extends Record<string, any>>(
  data: T[],
  options: ExportOptions
): Promise<void> {
  const { format, filename = 'export', onProgress } = options;
  
  if (format === 'csv') {
    await exportToCSV(data, filename, onProgress);
  } else if (format === 'json') {
    await exportToJSON(data, filename, onProgress);
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(baseName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${baseName}-${timestamp}`;
}
