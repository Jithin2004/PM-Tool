import React, { useState } from 'react';

/* ================================================================
   RESOLVE PM — Core Avatar Component
   Source of truth: Design Bible Phase 10-11, 17
   
   Rules:
     - Clear fallback to initials when image is missing or errors.
     - Consistent circle styling.
     - Sized strictly (sm: 24px, md: 32px, lg: 40px).
   ================================================================ */

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-[var(--text-sm)]',
  lg: 'w-10 h-10 text-[var(--text-md)]',
};

export function Avatar({ src, name = '', size = 'md', className = '', ...props }: AvatarProps) {
  const [error, setError] = useState(false);

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const showFallback = !src || error;

  return (
    <div
      className={[
        'relative inline-flex items-center justify-center flex-shrink-0',
        'rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] overflow-hidden',
        sizeClasses[size],
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {showFallback ? (
        <span className="font-medium text-[var(--color-text-secondary)] select-none">
          {getInitials(name)}
        </span>
      ) : (
        <img
          src={src}
          alt={name}
          onError={() => setError(true)}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}
