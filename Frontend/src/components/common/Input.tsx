import React from 'react';
import { cx } from '@/utils/cx';

interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'search';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  onKeyDown,
  disabled,
  className,
  label,
  error,
  helperText,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        className={cx(
          'px-3 py-2 border rounded-md text-sm font-family-base',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-600',
          {
            'border-slate-700 bg-[#161b25] hover:border-neutral-400': !error && !disabled,
            'border-danger-600 bg-danger-50': Boolean(error),
            'border-slate-800 bg-neutral-50 text-neutral-500 cursor-not-allowed': Boolean(disabled),
          },
          className
        )}
      />
      {error && <span className="text-xs text-danger-600">{error}</span>}
      {helperText && !error && <span className="text-xs text-neutral-500">{helperText}</span>}
    </div>
  );
}
