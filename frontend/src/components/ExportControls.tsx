/**
 * ExportControls component
 * 
 * Provides UI for:
 * - Export format selection (CSV/JSON)
 * - Date range selection
 * - Export button with progress indicator
 */
import { useState } from 'react';
import { ExportFormat, exportData, generateFilename } from '../utils/exportUtils';

interface ExportControlsProps {
  data: any[];
  baseFilename: string;
  disabled?: boolean;
}

interface DateRange {
  start: Date;
  end: Date;
}

export function ExportControls({ data, baseFilename, disabled = false }: ExportControlsProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    end: new Date(),
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    if (data.length === 0) return;
    
    setIsExporting(true);
    setExportProgress(0);

    try {
      // Filter data by date range if timestamp field exists
      let filteredData = data;
      if (data[0]?.timestamp) {
        filteredData = data.filter((item: any) => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= dateRange.start && itemDate <= dateRange.end;
        });
      }

      const filename = generateFilename(baseFilename);
      
      await exportData(filteredData, {
        format,
        filename,
        onProgress: (progress) => setExportProgress(progress),
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      {/* Format selection */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
        Format:
      </label>
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as ExportFormat)}
        disabled={isExporting || disabled}
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid var(--color-border)',
          fontSize: '13px',
          cursor: isExporting || disabled ? 'not-allowed' : 'pointer',
          background: isExporting || disabled ? 'var(--color-input-disabled)' : 'var(--color-input-bg)',
          color: 'var(--color-text-primary)',
        }}
      >
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
      </select>
    </div>

      {/* Date range selection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          From:
        </label>
        <input
          type="datetime-local"
          value={dateRange.start.toISOString().slice(0, 16)}
          onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
          disabled={isExporting || disabled}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            fontSize: '13px',
            cursor: isExporting || disabled ? 'not-allowed' : 'pointer',
            background: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
          }}
        />
        <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          To:
        </label>
        <input
          type="datetime-local"
          value={dateRange.end.toISOString().slice(0, 16)}
          onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
          disabled={isExporting || disabled}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            fontSize: '13px',
            cursor: isExporting || disabled ? 'not-allowed' : 'pointer',
            background: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={isExporting || disabled || data.length === 0}
        style={{
          padding: '6px 16px',
          borderRadius: '6px',
          border: '1px solid var(--color-primary)',
          background: isExporting ? 'var(--color-primary-light)' : 'var(--color-primary)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 500,
          cursor: isExporting || disabled || data.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {isExporting ? (
          <>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
            Exporting {exportProgress}%
          </>
        ) : (
          'Export Data'
        )}
      </button>

      {/* Progress bar */}
      {isExporting && (
        <div
          style={{
            width: '100px',
            height: '6px',
            background: 'var(--color-progress-bg)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${exportProgress}%`,
              height: '100%',
              background: 'var(--color-primary)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
