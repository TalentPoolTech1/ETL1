import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Checkbox({ checked, onChange, label, disabled = false, id }: CheckboxProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 border border-neutral-300 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
      {label && (
        <label htmlFor={id} className="text-sm text-neutral-700 cursor-pointer">
          {label}
        </label>
      )}
    </div>
  );
}
