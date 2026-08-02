'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useInView } from 'framer-motion';

export interface GalleryImage {
  alt: string;
  src: string;
  width: number;
  height: number;
  placeholder?: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function ImageGallery({ images, columns = 3, className }: ImageGalleryProps) {
  const groups = React.useMemo(
    () => Array.from({ length: columns }, (_, col) => images.filter((_, index) => index % columns === col)),
    [images, columns],
  );

  return (
    <div className={cn('relative w-full px-4 py-10', className)}>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group, col) => (
          <div key={col} className="grid content-start gap-5">
            {group.map((image) => <AnimatedImage key={image.src} {...image} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimatedImage({ alt, src, width, height, placeholder }: GalleryImage) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '120px' });
  const [isLoading, setIsLoading] = React.useState(true);
  const [imgSrc, setImgSrc] = React.useState(src);

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-slate-900/10 bg-slate-100 shadow-sm">
      <img
        alt={alt}
        src={imgSrc}
        width={width}
        height={height}
        className={cn('block h-auto w-full opacity-0 transition-opacity duration-700 ease-out', {
          'opacity-100': isInView && !isLoading,
        })}
        onLoad={() => setIsLoading(false)}
        loading="lazy"
        decoding="async"
        onError={() => placeholder && setImgSrc(placeholder)}
      />
    </div>
  );
}