import React from 'react';

interface IconContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function IconContainer({ children, className = '' }: IconContainerProps) {
  return (
    <div className={`icon-container-bespoke ${className}`}>
      {children}
    </div>
  );
}
