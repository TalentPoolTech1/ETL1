/**
 * Execution Point Panel Component
 * 
 * Displays segment eligibility, allows users to switch execution points,
 * and shows impact preview before changes.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  Lock,
  AlertCircle,
  Zap,
  Database,
  SlackIcon as Spark,
} from 'lucide-react';
import {
  SegmentEligibility,
  ExecutionPoint,
  EligibilityAnalysis,
} from '@/transformations/pushdown/PushdownEligibilityEngine';
import { ExecutionPointStateManager, ExecutionPointSwitchImpact } from '@/transformations/pushdown/ExecutionPointState';
import { TransformSequence } from '@/transformations/ir';

interface ExecutionPointPanelProps {
  analysis: EligibilityAnalysis;
  stateManager: ExecutionPointStateManager;
  sequence: TransformSequence;
  onExecutionPointChange?: (stepId: string, newPoint: ExecutionPoint) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Execution Point choice button
 */
function ExecutionPointButton({
  point,
  isSelected,
  isForcedLocked,
  onClick,
  disabled,
}: {
  point: ExecutionPoint;
  isSelected: boolean;
  isForcedLocked: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const getButtonContent = () => {
    switch (point) {
      case 'source':
        return {
          icon: <Database className="w-4 h-4" />,
          label: 'Source DB',
          desc: 'Execute in source database (fast)',
        };
      case 'pyspark':
        return {
          icon: <Spark className="w-4 h-4" />,
          label: 'PySpark',
          desc: 'Execute in PySpark cluster (flexible)',
        };
      case 'forced_pyspark':
        return {
          icon: <Lock className="w-4 h-4" />,
          label: 'Locked (PySpark)',
          desc: 'Cannot be changed',
        };
    }
  };

  const content = getButtonContent();

  return (
    <button
      onClick={onClick}
      disabled={disabled || isForcedLocked}
      className={`
        flex-1 p-3 rounded-lg border-2 transition-all
        flex flex-col items-center gap-1 text-sm
        ${isSelected
          ? 'border-blue-500 bg-blue-50 text-blue-900'
          : disabled || isForcedLocked
            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'}
      `}
    >
      {content.icon}
      <div className="font-medium">{content.label}</div>
      <div className="text-xs text-gray-500">{content.desc}</div>
    </button>
  );
}

/**
 * Impact preview card
 */
function ImpactPreview({
  impact,
  onConfirm,
  onCancel,
}: {
  impact: ExecutionPointSwitchImpact;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-3 mb-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-amber-900">Impact Preview</h4>
          <p className="text-sm text-amber-800 mt-1">
            {impact.dataMovementRequired
              ? 'This change will require moving data from source to PySpark cluster.'
              : 'Review the changes below before confirming.'}
          </p>
        </div>
      </div>

      {impact.affectedSteps.length > 0 && (
        <div className="mb-3 p-2 bg-white rounded border border-amber-100">
          <div className="text-sm font-medium text-gray-700 mb-2">Affected steps:</div>
          <ul className="text-sm text-gray-600 space-y-1">
            {impact.affectedSteps.map((stepId, idx) => (
              <li key={idx} className="pl-4 flex items-center gap-2">
                <ChevronRight className="w-3 h-3" />
                {stepId}
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact.warnings.length > 0 && (
        <div className="mb-3 p-2 bg-white rounded border border-amber-100">
          <div className="text-sm font-medium text-gray-700 mb-2">Warnings:</div>
          <ul className="text-sm text-amber-700 space-y-1">
            {impact.warnings.map((warning, idx) => (
              <li key={idx} className="pl-4 flex items-center gap-2">
                <span className="text-amber-500">⚠</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact.estimatedPerformanceImpact && (
        <div className="mb-3 p-2 bg-white rounded border border-amber-100">
          <div className="text-sm font-medium text-gray-700 mb-1">Performance impact:</div>
          <div className="flex items-center gap-2">
            <Zap
              className={`w-4 h-4 ${
                impact.estimatedPerformanceImpact === 'high'
                  ? 'text-red-500'
                  : impact.estimatedPerformanceImpact === 'medium'
                    ? 'text-amber-500'
                    : 'text-green-500'
              }`}
            />
            <span className="text-sm text-gray-600">{impact.estimatedPerformanceImpact}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-amber-100">
        <button
          onClick={onConfirm}
          className="flex-1 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition-colors"
        >
          Confirm Change
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 bg-white border border-amber-200 text-amber-700 text-sm font-medium rounded hover:bg-amber-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Segment eligibility card
 */
function SegmentCard({
  segment,
  currentExecutionPoint,
  onExecutionPointChange,
  stateManager,
  sequence,
}: {
  segment: SegmentEligibility;
  currentExecutionPoint: ExecutionPoint | null;
  onExecutionPointChange: (newPoint: ExecutionPoint) => void;
  stateManager: ExecutionPointStateManager;
  sequence: TransformSequence;
}) {
  const [previewPoint, setPreviewPoint] = useState<ExecutionPoint | null>(null);
  const [showImpact, setShowImpact] = useState(false);

  const previewImpact = useMemo(() => {
    if (!previewPoint) return null;
    return stateManager.previewSwitch(segment.segmentId, previewPoint, sequence);
  }, [previewPoint]);

  const handlePointSelect = (point: ExecutionPoint) => {
    if (currentExecutionPoint === 'forced_pyspark') {
      // Can't change forced
      return;
    }
    setPreviewPoint(point);
    setShowImpact(true);
  };

  const handleConfirmChange = () => {
    if (previewPoint && previewImpact?.valid) {
      onExecutionPointChange(previewPoint);
      setShowImpact(false);
      setPreviewPoint(null);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{segment.stepRange}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {segment.sourceTechnologies.join(', ') || 'Unknown source'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {segment.eligible ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
              ✓ Eligible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
              ✗ Not eligible
            </span>
          )}
        </div>
      </div>

      {/* Reason/Eligibility details */}
      {segment.reasons.length > 0 && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800">
          <div className="font-medium mb-1">Why this is eligible:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {segment.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {segment.ineligibilityReasons && segment.ineligibilityReasons.length > 0 && (
        <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-800">
          <div className="font-medium mb-1">Why it cannot be pushed down:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {segment.ineligibilityReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Execution point selector */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Execution Point:
        </label>
        <div className="flex gap-2">
          <ExecutionPointButton
            point="source"
            isSelected={currentExecutionPoint === 'source'}
            isForcedLocked={currentExecutionPoint === 'forced_pyspark'}
            onClick={() => handlePointSelect('source')}
            disabled={!segment.eligible}
          />
          <ExecutionPointButton
            point="pyspark"
            isSelected={currentExecutionPoint === 'pyspark'}
            isForcedLocked={currentExecutionPoint === 'forced_pyspark'}
            onClick={() => handlePointSelect('pyspark')}
            disabled={false}
          />
          {currentExecutionPoint === 'forced_pyspark' && (
            <ExecutionPointButton
              point="forced_pyspark"
              isSelected={true}
              isForcedLocked={true}
              onClick={() => {}}
              disabled={true}
            />
          )}
        </div>
      </div>

      {/* Affected columns */}
      {segment.affectedColumns.length > 0 && (
        <div className="mb-3 text-sm">
          <div className="font-medium text-gray-700 mb-1">Affected columns:</div>
          <div className="flex flex-wrap gap-1">
            {segment.affectedColumns.slice(0, 5).map((col, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-mono"
              >
                {col}
              </span>
            ))}
            {segment.affectedColumns.length > 5 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                +{segment.affectedColumns.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Impact preview */}
      {showImpact && previewImpact && (
        <ImpactPreview
          impact={previewImpact}
          onConfirm={handleConfirmChange}
          onCancel={() => {
            setShowImpact(false);
            setPreviewPoint(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Execution Point Panel Component
 */
export function ExecutionPointPanel({
  analysis,
  stateManager,
  sequence,
  onExecutionPointChange,
  isOpen = true,
  onClose,
}: ExecutionPointPanelProps) {
  const summary = stateManager.getSummary();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="w-96 border-l border-gray-200 bg-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">Execution Strategy</h2>
          <p className="text-sm text-gray-500 mt-1">Configure where each segment executes</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{summary.pushdownCount}</div>
            <div className="text-xs text-gray-600">Source DB</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">{summary.pysparkCount}</div>
            <div className="text-xs text-gray-600">PySpark</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{summary.forcedCount}</div>
            <div className="text-xs text-gray-600">Locked</div>
          </div>
        </div>
      </div>

      {/* Segments list */}
      <div className="p-4 space-y-4">
        {analysis.segments.map((segment) => {
          const currentPoint = stateManager.getExecutionPoint(segment.segmentId);
          return (
            <SegmentCard
              key={segment.segmentId}
              segment={segment}
              currentExecutionPoint={currentPoint}
              onExecutionPointChange={(newPoint) => {
                const result = stateManager.applyExecutionPointChange(
                  segment.segmentId,
                  newPoint,
                  sequence
                );
                if (result.success && onExecutionPointChange) {
                  onExecutionPointChange(segment.segmentId, newPoint);
                }
              }}
              stateManager={stateManager}
              sequence={sequence}
            />
          );
        })}
      </div>

      {/* Export button */}
      <div className="sticky bottom-0 p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => {
            const config = stateManager.exportConfiguration();
            console.log('Exported execution point configuration:', config);
          }}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
        >
          Export Configuration
        </button>
      </div>
    </div>
  );
}

export default ExecutionPointPanel;
