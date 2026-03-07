import React, { useState, useMemo, useRef, useEffect } from 'react';

interface PreviewRow {
  [key: string]: any;
}

interface ColumnState {
  [colName: string]: {
    hidden?: boolean;
    pinned?: 'left' | 'right' | null;
    width?: number;
  };
}

const sampleData: PreviewRow[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'][Math.floor(Math.random() * 5)],
  email: `user${i + 1}@example.com`,
  status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
  created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
}));

const ITEM_HEIGHT = 32;
const VISIBLE_ITEMS = 15;

export function DataPreviewPanel() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnState, setColumnState] = useState<ColumnState>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [filterText, setFilterText] = useState('');

  const allColumns = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];
  const visibleColumns = allColumns.filter(col => !columnState[col]?.hidden);

  // Calculate profile stats
  const stats = useMemo(() => {
    const totalRows = sampleData.length;
    const nullCount = sampleData.filter(r => Object.values(r).some(v => v === null)).length;
    const sizeEstimate = JSON.stringify(sampleData).length / 1024; // KB

    return {
      totalRows,
      nullCount,
      sizeEstimate: sizeEstimate.toFixed(1),
    };
  }, []);

  // Sort and filter data
  const filteredData = useMemo(() => {
    let result = [...sampleData];

    // Apply filter
    if (filterText) {
      result = result.filter(row =>
        Object.values(row).some(v =>
          String(v).toLowerCase().includes(filterText.toLowerCase())
        )
      );
    }

    // Apply sort
    if (sortBy) {
      result.sort((a, b) => {
        const aVal = a[sortBy.column];
        const bVal = b[sortBy.column];

        if (typeof aVal === 'string') {
          return sortBy.direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        } else {
          return sortBy.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
      });
    }

    return result;
  }, [sortBy, filterText]);

  // Virtual scrolling
  const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const endIndex = startIndex + VISIBLE_ITEMS;
  const visibleData = filteredData.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  const handleScroll = (e: React.UIEvent) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  };

  const handleColumnSort = (col: string) => {
    if (sortBy?.column === col) {
      setSortBy({
        column: col,
        direction: sortBy.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortBy({ column: col, direction: 'asc' });
    }
  };

  const handleToggleColumnVisibility = (col: string) => {
    setColumnState(prev => ({
      ...prev,
      [col]: {
        ...prev[col],
        hidden: !prev[col]?.hidden,
      },
    }));
  };

  const handlePinColumn = (col: string, position: 'left' | 'right' | null) => {
    setColumnState(prev => ({
      ...prev,
      [col]: {
        ...prev[col],
        pinned: position,
      },
    }));
  };

  const exportData = (format: 'csv' | 'json') => {
    let content = '';

    if (format === 'csv') {
      const headers = visibleColumns.join(',');
      const rows = visibleData.map(row => visibleColumns.map(col => row[col]).join(','));
      content = [headers, ...rows].join('\n');
    } else {
      content = JSON.stringify(visibleData, null, 2);
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <div className="h-65 bg-white border-t border-neutral-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-neutral-200 flex items-center justify-between px-4 bg-neutral-50">
        <div className="flex items-center gap-3 flex-1">
          <h3 className="text-sm font-medium text-neutral-900">Data Preview</h3>
          <div className="text-xs text-neutral-600">
            {filteredData.length} rows {filterText && `(filtered from ${sampleData.length})`}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search filter */}
          <input
            type="text"
            placeholder="Search..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="px-2 py-1.5 border border-neutral-300 rounded text-xs placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* Profile stats dropdown */}
          <div className="relative">
            <button
              className="px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-200 rounded"
              title="Profile stats"
            >
              📊
            </button>
            <div className="absolute right-0 bg-white border border-neutral-200 rounded-md shadow-lg text-xs mt-1 p-2 z-10 min-w-48">
              <p className="text-neutral-700">
                <strong>Rows:</strong> {stats.totalRows.toLocaleString()}
              </p>
              <p className="text-neutral-700">
                <strong>Nulls:</strong> {stats.nullCount}
              </p>
              <p className="text-neutral-700">
                <strong>Size:</strong> {stats.sizeEstimate} KB
              </p>
            </div>
          </div>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-200 rounded"
          >
            ⚙️
          </button>

          {/* Export button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-200 rounded"
          >
            📥
          </button>
        </div>
      </div>

      {/* Column settings panel */}
      {showSettings && (
        <div className="h-24 border-b border-neutral-200 bg-neutral-50 px-4 py-2 overflow-y-auto">
          <div className="text-xs font-medium text-neutral-700 mb-2">Columns</div>
          <div className="flex flex-wrap gap-2">
            {allColumns.map(col => (
              <div key={col} className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-neutral-200">
                <input
                  type="checkbox"
                  checked={!columnState[col]?.hidden}
                  onChange={() => handleToggleColumnVisibility(col)}
                  className="w-3 h-3"
                />
                <span className="text-xs text-neutral-700 flex-1">{col}</span>
                <select
                  value={columnState[col]?.pinned || 'none'}
                  onChange={e =>
                    handlePinColumn(col, e.target.value === 'none' ? null : (e.target.value as 'left' | 'right'))
                  }
                  className="text-xs px-1 py-0 border border-neutral-200 rounded"
                >
                  <option value="none">—</option>
                  <option value="left">📌L</option>
                  <option value="right">📌R</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Table header */}
        <div className="sticky top-0 bg-neutral-50 border-b border-neutral-200 flex h-8">
          {visibleColumns.map(col => (
            <div
              key={col}
              className="flex-1 min-w-32 px-4 py-1.5 text-left text-xs font-semibold text-neutral-700 border-r border-neutral-200 flex items-center justify-between whitespace-nowrap cursor-pointer hover:bg-neutral-100"
              onClick={() => handleColumnSort(col)}
            >
              <span>{col}</span>
              <span className="ml-1">
                {sortBy?.column === col ? (sortBy.direction === 'asc' ? '▲' : '▼') : ''}
              </span>
            </div>
          ))}
        </div>

        {/* Virtualized table body */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
          style={{ height: `${VISIBLE_ITEMS * ITEM_HEIGHT}px` }}
        >
          <div style={{ height: `${filteredData.length * ITEM_HEIGHT}px`, position: 'relative' }}>
            <div
              style={{
                transform: `translateY(${offsetY}px)`,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
              }}
            >
              {visibleData.map((row, idx) => (
                <div key={startIndex + idx} className="flex h-8 border-b border-neutral-100 hover:bg-neutral-50">
                  {visibleColumns.map(col => (
                    <div
                      key={col}
                      className="flex-1 min-w-32 px-4 py-1.5 text-xs text-neutral-700 border-r border-neutral-100 overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      {String(row[col]).substring(0, 50)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Export Data</h3>
            <div className="space-y-2 mb-4">
              <button
                onClick={() => exportData('csv')}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
              >
                📄 Export as CSV
              </button>
              <button
                onClick={() => exportData('json')}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
              >
                {'{}'} Export as JSON
              </button>
            </div>
            <button
              onClick={() => setShowExportModal(false)}
              className="w-full px-4 py-2 bg-neutral-200 text-neutral-900 rounded-md text-sm hover:bg-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
