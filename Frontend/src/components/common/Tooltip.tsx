import React, { ReactNode, useState } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>

      {isVisible && (
        <div className={`absolute ${positionClasses[position]} bg-neutral-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none`}>
          {content}
          <div
            className={`absolute ${
              position === 'top'
                ? 'top-full'
                : position === 'bottom'
                  ? 'bottom-full'
                  : position === 'left'
                    ? 'left-full'
                    : 'right-full'
            } w-1.5 h-1.5 bg-neutral-900`}
            style={{
              borderRadius: '50%',
            }}
          />
        </div>
      )}
    </div>
  );
}
