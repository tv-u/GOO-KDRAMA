import React from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

function buildTmdbSrcSet(src: string): string | undefined {
  if (!src || !src.includes('image.tmdb.org/t/p/')) return undefined;
  const match = src.match(/^(https:\/\/image\.tmdb\.org\/t\/p\/)(?:w\d+|original)(\/.+)$/);
  if (!match) return undefined;
  const [, prefix, filePath] = match;
  return `${prefix}w342${filePath} 342w, ${prefix}w500${filePath} 500w, ${prefix}w780${filePath} 780w`;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 500,
  height = 750,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 18vw',
  priority = false,
  className = '',
}) => {
  const safeSrc = src || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg';
  const srcSet = buildTmdbSrcSet(safeSrc);

  return (
    <img
      src={safeSrc}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      referrerPolicy="no-referrer"
      className={className}
    />
  );
};
