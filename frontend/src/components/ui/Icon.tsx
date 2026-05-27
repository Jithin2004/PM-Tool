import React from 'react';

interface IconProps {
  name: string;
  size?: number | string;
  fill?: boolean;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  grade?: -25 | 0 | 200;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wrapper for Google Material Symbols Outlined.
 * Requires the Material Symbols font loaded in index.html.
 * Usage: <Icon name="dashboard" fill className="text-[20px]" />
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  fill = false,
  weight = 400,
  grade = 0,
  className = '',
  style,
}) => {
  const fontVariation = `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${size}`;
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{ fontSize: typeof size === 'number' ? `${size}px` : size, fontVariationSettings: fontVariation, ...style }}
    >
      {name}
    </span>
  );
};

export default Icon;
