import React, { ReactNode } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
}

export function Alert({ variant = 'info', title, children, onClose }: AlertProps) {
  const variantClasses: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> =
    {
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-900',
        icon: 'ℹ️',
      },
      success: {
        bg: 'bg-success-50',
        border: 'border-success-200',
        text: 'text-success-900',
        icon: '✓',
      },
      warning: {
        bg: 'bg-warning-50',
        border: 'border-warning-200',
        text: 'text-warning-900',
        icon: '⚠️',
      },
      danger: {
        bg: 'bg-danger-50',
        border: 'border-danger-200',
        text: 'text-danger-900',
        icon: '✕',
      },
    };

  const themed = variantClasses[variant];

  return (
    <div className={`${themed.bg} border ${themed.border} rounded-md p-4 ${themed.text}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{themed.icon}</span>
        <div className="flex-1">
          {title && <p className="font-semibold text-sm mb-1">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-lg hover:opacity-70">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
