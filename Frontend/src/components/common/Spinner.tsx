import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function Spinner({ size = 'md', color = 'primary' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  const colorClass = color === 'primary' ? 'border-primary-600' : 'border-neutral-600';

  return (
    <div className={`inline-block ${sizeClasses[size]} border-t-transparent border-solid rounded-full animate-spin ${colorClass}`} />
  );
}
