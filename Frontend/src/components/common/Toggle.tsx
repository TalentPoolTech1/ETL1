import React from 'react';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ enabled, onChange, label, disabled = false }: ToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`
          relative inline-block w-10 h-6 rounded-full transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${enabled ? 'bg-primary-600' : 'bg-neutral-300'}
        `}
      >
        <div
          className={`
            absolute top-1 left-1 w-4 h-4 bg-[#161b25] rounded-full transition-transform
            ${enabled ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
      {label && <span className="text-sm text-neutral-700">{label}</span>}
    </div>
  );
}
