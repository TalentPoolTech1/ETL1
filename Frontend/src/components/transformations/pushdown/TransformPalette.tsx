/**
 * Transform Palette with Function Availability
 * 
 * Enhanced transformation palette that shows:
 * - Available functions with green ✓
 * - Alternative functions with amber ⚠ and suggestions
 * - Unavailable functions with red ✗ and explanations
 * - One-click switches to alternative implementations
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  AlertCircle,
  XCircle,
  ChevronRight,
  ZapOff,
  Info,
} from 'lucide-react';
import {
  FunctionAvailabilityFilter,
  FunctionAvailabilityResult,
  FunctionPalette,
} from '../../../transformations/pushdown/FunctionAvailabilityFilter';
import { SourceTechnology } from '../../../transformations/pushdown/CapabilityMatrix';

interface TransformPaletteProps {
  sourceTechnology: SourceTechnology;
  executionPoint: 'source' | 'pyspark' | 'forced_pyspark';
  onSelectFunction: (functionId: string) => void;
  filter?: FunctionAvailabilityFilter;
  selectedFunctionIds?: string[];
  allowUnavailable?: boolean; // Allow adding unavailable functions (for PySpark fallback)
}

/**
 * Function availability badge
 */
function AvailabilityBadge({
  result,
}: {
  result: FunctionAvailabilityResult;
}) {
  switch (result.availability) {
    case 'available':
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
          <Check className="w-3 h-3" />
          Available
        </div>
      );

    case 'alternative':
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
          <AlertCircle className="w-3 h-3" />
          Alternative
        </div>
      );

    case 'unavailable':
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
          <XCircle className="w-3 h-3" />
          Unavailable
        </div>
      );
  }
}

/**
 * Function card component
 */
function FunctionCard({
  result,
  onSelect,
  isSelected,
}: {
  result: FunctionAvailabilityResult;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const canAdd =
    result.availability === 'available' ||
    (result.availability === 'alternative') ||
    result.canAdd;

  return (
    <div
      className={`
        border rounded-lg p-3 transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-800 hover:border-slate-700'}
        ${!canAdd ? 'opacity-60 cursor-not-allowed' : ''}
      `}
      onClick={() => canAdd && onSelect()}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-white">{result.label}</h4>
          <p className="text-xs text-slate-300 mt-1">{result.functionId}</p>
        </div>
        <AvailabilityBadge result={result} />
      </div>

      {/* Source implementation info */}
      {result.sourceImplementation && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-slate-200">
          <span className="font-medium">
            {result.sourceImplementation.sourceTech}:
          </span>{' '}
          <code className="font-mono">{result.sourceImplementation.implementation}</code>
          {result.sourceImplementation.notes && (
            <p className="mt-1 text-slate-300">{result.sourceImplementation.notes}</p>
          )}
        </div>
      )}

      {/* Message */}
      {result.message && (
        <p className="text-xs text-slate-300 mb-2">{result.message}</p>
      )}

      {/* Alternative suggestion */}
      {result.alternativeSuggestion && (
        <div className="mb-2 p-2 bg-amber-50 border border-amber-100 rounded">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className="flex items-center gap-2 text-xs font-medium text-amber-700 hover:text-amber-800"
          >
            <Info className="w-3 h-3" />
            {result.availability === 'alternative' ? 'See alternative' : 'Switch to alternative'}
            <ChevronRight
              className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`}
            />
          </button>

          {showDetails && (
            <div className="mt-2 text-xs text-amber-700">
              <p className="mb-1">
                <strong>Alternative:</strong>{' '}
                {result.alternativeSuggestion.alternativeLabel}
              </p>
              <p>{result.alternativeSuggestion.reason}</p>
            </div>
          )}
        </div>
      )}

      {/* Disabled message */}
      {!canAdd && (
        <div className="flex items-center gap-2 text-xs text-red-700 font-medium">
          <ZapOff className="w-3 h-3" />
          {result.message || 'Cannot be used with current settings'}
        </div>
      )}
    </div>
  );
}

/**
 * Category section
 */
function CategorySection({
  title,
  functions,
  onSelect,
  selectedFunctionIds,
}: {
  title: string;
  functions: FunctionAvailabilityResult[];
  onSelect: (functionId: string) => void;
  selectedFunctionIds: string[];
}) {
  if (functions.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide opacity-70">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {functions.map((result) => (
          <FunctionCard
            key={result.functionId}
            result={result}
            onSelect={() => onSelect(result.functionId)}
            isSelected={selectedFunctionIds.includes(result.functionId)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Transform Palette Component
 */
export function TransformPalette({
  sourceTechnology,
  executionPoint,
  onSelectFunction,
  filter: externalFilter,
  selectedFunctionIds = [],
  allowUnavailable = false,
}: TransformPaletteProps) {
  const filter = useMemo(
    () => externalFilter || new FunctionAvailabilityFilter(),
    [externalFilter]
  );

  const palette = useMemo(() => {
    return filter.filterFunctions(sourceTechnology, executionPoint);
  }, [filter, sourceTechnology, executionPoint]);

  return (
    <div className="w-full max-w-md mx-auto p-4">
      {/* Header info */}
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="font-semibold text-white">Transform Functions</h2>
        <p className="text-sm text-slate-300 mt-1">
          Source: <span className="font-medium">{sourceTechnology}</span> · Execution:{' '}
          <span className="font-medium capitalize">{executionPoint}</span>
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-green-50 rounded">
          <div className="text-lg font-bold text-green-600">
            {palette.available.length}
          </div>
          <div className="text-xs text-green-700">Available</div>
        </div>
        <div className="p-2 bg-amber-50 rounded">
          <div className="text-lg font-bold text-amber-600">
            {palette.alternatives.length}
          </div>
          <div className="text-xs text-amber-700">Alternative</div>
        </div>
        <div className="p-2 bg-red-50 rounded">
          <div className="text-lg font-bold text-red-600">
            {palette.unavailable.length}
          </div>
          <div className="text-xs text-red-700">Unavailable</div>
        </div>
      </div>

      {/* Functions grouped by availability */}
      <div className="space-y-6">
        {/* Available */}
        <CategorySection
          title="Available"
          functions={palette.available}
          onSelect={onSelectFunction}
          selectedFunctionIds={selectedFunctionIds}
        />

        {/* Alternatives */}
        {palette.alternatives.length > 0 && (
          <CategorySection
            title="With Alternatives"
            functions={palette.alternatives}
            onSelect={onSelectFunction}
            selectedFunctionIds={selectedFunctionIds}
          />
        )}

        {/* Unavailable (only if allowed) */}
        {allowUnavailable && palette.unavailable.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide opacity-70">
              Unavailable (PySpark only)
            </h3>
            <p className="text-xs text-slate-300 mb-3">
              These functions are not supported in {sourceTechnology}. Switch to PySpark execution to use them.
            </p>
            {/* Show as disabled but informative */}
            <div className="space-y-2 opacity-50">
              {palette.unavailable.slice(0, 3).map((result) => (
                <div
                  key={result.functionId}
                  className="border border-slate-800 rounded p-2 bg-[#0d0f1a]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-slate-200">
                      {result.label}
                    </span>
                    <span className="text-xs text-slate-300">Not available</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{result.message}</p>
                </div>
              ))}
              {palette.unavailable.length > 3 && (
                <p className="text-xs text-slate-300 pt-2">
                  +{palette.unavailable.length - 3} more unavailable in PySpark
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="mt-6 p-3 bg-[#0d0f1a] rounded-lg border border-slate-800">
        <p className="text-xs text-slate-300">
          💡 <strong>Tip:</strong> Available functions execute in {sourceTechnology} for better performance. Alternative functions work but may have different syntax. Unavailable functions require switching to PySpark.
        </p>
      </div>
    </div>
  );
}

export default TransformPalette;
