import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  variant?: 'text' | 'title' | 'rect' | 'circle';
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'rect',
  className = '',
  style,
}) => {
  const variantClass =
    variant === 'circle'
      ? 'zv-skeleton--circle'
      : variant === 'text'
      ? 'zv-skeleton--text'
      : variant === 'title'
      ? 'zv-skeleton--title'
      : '';

  return (
    <span
      className={`zv-skeleton ${variantClass} ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
};

interface SkeletonRowProps {
  avatarSize?: number;
  lines?: number;
  className?: string;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({
  avatarSize = 40,
  lines = 2,
  className = '',
}) => {
  return (
    <div className={`zv-skeleton-row ${className}`} aria-hidden="true">
      <Skeleton variant="circle" width={avatarSize} height={avatarSize} />
      <div className="zv-skeleton-row__body">
        <Skeleton variant="title" width="40%" />
        {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
          <Skeleton key={i} variant="text" width={i === lines - 2 ? '70%' : '90%'} />
        ))}
      </div>
    </div>
  );
};

interface SkeletonListProps {
  rows?: number;
  avatarSize?: number;
  lines?: number;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  rows = 6,
  avatarSize = 40,
  lines = 2,
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} avatarSize={avatarSize} lines={lines} />
      ))}
    </>
  );
};

export default Skeleton;
