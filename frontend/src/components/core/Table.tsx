import React from 'react';

/* ================================================================
   RESOLVE PM — Core Table Component
   Source of truth: Design Bible Phase 10-11, 18
   
   Rules:
     - Fixed header.
     - Row separators only (no vertical grid lines).
     - Row height: 40px standard, 32px compact.
     - Column headers in UPPERCASE 11px (text-xs).
     - Actions right-aligned.
     - Alternating row highlights (zebra) optional for dense tables only.
   ================================================================ */

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  density?: 'standard' | 'compact';
  zebra?: boolean; // alternating rows
  keyExtractor: (row: T, index: number) => string | number;
  emptyState?: React.ReactNode;
}

export function Table<T>({
  columns,
  data,
  onRowClick,
  density = 'standard',
  zebra = false,
  keyExtractor,
  emptyState,
}: TableProps<T>) {
  const rowHeightClass = density === 'compact' ? 'py-1.5' : 'py-2.5';
  const showZebra = zebra && columns.length > 8;

  if (data.length === 0 && emptyState) {
    return <div className="border border-[var(--color-border-strong)] rounded-[var(--radius-lg)] overflow-hidden bg-[var(--color-surface-1)]">{emptyState}</div>;
  }

  return (
    <div className="w-full border border-[var(--color-border-strong)] rounded-[var(--radius-lg)] overflow-x-auto select-text bg-[var(--color-surface-1)]">
      <table className="w-full border-collapse text-left text-[13px]">
        {/* Table Header: Fixed & Uppercase 11px (text-xs) */}
        <thead>
          <tr className="border-b border-[var(--color-border-strong)] bg-[var(--color-surface-2)]">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={{ width: col.width }}
                className={[
                  'px-4 py-3',
                  'text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-muted)]',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body: Separators only */}
        <tbody className="divide-y divide-[var(--color-border)]">
          {data.map((row, rIdx) => {
            const isClickable = !!onRowClick;
            return (
              <tr
                key={keyExtractor(row, rIdx)}
                onClick={() => onRowClick?.(row)}
                className={[
                  'group transition-colors duration-[var(--dur-fast)]',
                  showZebra && rIdx % 2 === 1 ? 'bg-white/[0.015]' : 'bg-transparent',
                  isClickable ? 'hover:bg-white/[0.025] cursor-pointer' : 'hover:bg-white/[0.01]',
                ].join(' ')}
              >
                {columns.map((col) => {
                  const isActions = col.key.toLowerCase().includes('action');
                  return (
                    <td
                      key={col.key}
                      className={[
                        'px-4 align-middle text-[var(--color-text-primary)]',
                        rowHeightClass,
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                        isActions ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--dur-fast)]' : '',
                      ].join(' ')}
                    >
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
