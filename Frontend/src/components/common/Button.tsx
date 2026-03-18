import React from 'react';
import { cx } from '@/utils/cx';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick,
  className,
  type = 'button',
  title,
}: ButtonProps) {
  return (
    <button
      type={type}
      title={title}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-colors rounded-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        {
          // Variants
          'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800':
            variant === 'primary',
          'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 active:bg-neutral-400':
            variant === 'secondary',
          'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800': variant === 'danger',
          'text-primary-600 hover:bg-primary-50': variant === 'ghost',
          // Sizes
          'px-3 py-1 text-xs': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
          // States
          'opacity-50 cursor-not-allowed': disabled,
        },
        className
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
