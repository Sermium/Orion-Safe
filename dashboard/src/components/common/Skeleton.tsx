import React from 'react';

/**
 * Skeleton primitives.
 *
 * Every placeholder is `aria-hidden` — the surrounding view wrapper carries the
 * single `role="status"` announcement so screen readers hear "loading" once
 * rather than once per box.
 */

interface SkeletonProps {
  className?: string;
  /** 1-5, staggers the shimmer so lists ripple instead of pulsing in unison. */
  delay?: number;
}

const delayClass = (delay?: number) =>
  delay && delay > 0 ? ` skeleton-delay-${Math.min(delay, 5)}` : '';

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', delay }) => (
  <div className={`skeleton rounded${delayClass(delay)} ${className}`} aria-hidden="true" />
);

/** A run of text lines, the last one short so it reads like a paragraph. */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        delay={i % 5}
        className={`h-3 ${i === lines - 1 ? 'w-2/5' : i % 3 === 1 ? 'w-11/12' : 'w-full'}`}
      />
    ))}
  </div>
);

/** Matches the stat tiles used across Dashboard / Members / Locks / Vesting. */
export const SkeletonStatCard: React.FC<{ delay?: number }> = ({ delay }) => (
  <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50">
    <Skeleton className="h-3 w-24 mb-3" delay={delay} />
    <Skeleton className="h-8 w-32 mb-2" delay={delay} />
    <Skeleton className="h-3 w-20" delay={delay} />
  </div>
);

export const SkeletonStatGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonStatCard key={i} delay={i} />
    ))}
  </div>
);

/** Page title + subtitle, optionally with a primary action button on the right. */
export const SkeletonPageHeader: React.FC<{ action?: boolean }> = ({ action = true }) => (
  <div className="flex items-center justify-between">
    <div>
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-64" delay={1} />
    </div>
    {action && <Skeleton className="h-10 w-36 rounded-xl" delay={2} />}
  </div>
);

/** One row of a list/table: leading avatar, two stacked lines, trailing value. */
export const SkeletonListRow: React.FC<{ delay?: number; avatar?: boolean }> = ({
  delay,
  avatar = true,
}) => (
  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/40 border border-gray-700/40">
    {avatar && <Skeleton className="h-10 w-10 rounded-full shrink-0" delay={delay} />}
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-4 w-1/3" delay={delay} />
      <Skeleton className="h-3 w-1/2" delay={delay} />
    </div>
    <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
      <Skeleton className="h-4 w-24" delay={delay} />
      <Skeleton className="h-3 w-16" delay={delay} />
    </div>
  </div>
);

export const SkeletonList: React.FC<{ rows?: number; avatar?: boolean }> = ({
  rows = 5,
  avatar = true,
}) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonListRow key={i} delay={i % 5} avatar={avatar} />
    ))}
  </div>
);

/** Lock / vesting card: badges, a progress bar, then a metadata grid. */
export const SkeletonProgressCard: React.FC<{ delay?: number }> = ({ delay }) => (
  <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-4">
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <Skeleton className="h-5 w-24" delay={delay} />
      <Skeleton className="h-5 w-20 rounded" delay={delay} />
      <Skeleton className="h-5 w-16 rounded" delay={delay} />
    </div>
    <Skeleton className="h-2 w-full rounded-full mb-4" delay={delay} />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-16" delay={delay} />
          <Skeleton className="h-4 w-20" delay={delay} />
        </div>
      ))}
    </div>
  </div>
);

/** Settings-style panel: section title then labelled form fields. */
export const SkeletonFormSection: React.FC<{ fields?: number; delay?: number }> = ({
  fields = 3,
  delay,
}) => (
  <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 space-y-5">
    <Skeleton className="h-5 w-40" delay={delay} />
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton className="h-3 w-28" delay={i % 5} />
        <Skeleton className="h-10 w-full rounded-xl" delay={i % 5} />
      </div>
    ))}
  </div>
);

/**
 * Wraps a skeleton screen and announces the load once.
 * `label` should name the view so the announcement is useful.
 */
export const SkeletonScreen: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
    <span className="sr-only">{label}</span>
    {children}
  </div>
);
