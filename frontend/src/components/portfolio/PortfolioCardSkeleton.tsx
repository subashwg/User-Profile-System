import React from 'react';
import SkeletonCard from '../ui/Skeleton.js';

export interface PortfolioCardSkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function PortfolioCardSkeleton({ className = '', style }: PortfolioCardSkeletonProps) {
  return <SkeletonCard aspectRatio="16 / 9" className={className} style={style} />;
}
