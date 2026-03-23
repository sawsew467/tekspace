import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
}

export const Skeleton = ({
  width,
  height,
  className = '',
  style,
}: SkeletonProps) => {
  // Convert width/height to CSS values
  const getSize = (size?: string | number) => {
    if (typeof size === 'number') return `${size}px`
    return size
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-muted ${className}`}
      style={{
        width: getSize(width),
        height: getSize(height),
        ...style,
      }}
    >
      {/* Shimmer effect using gradient */}
      <div className='animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent' />
    </div>
  )
}
