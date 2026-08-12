import React from 'react';
import type { ActiveView } from '../../types';
import {
  Skeleton,
  SkeletonText,
  SkeletonStatGrid,
  SkeletonPageHeader,
  SkeletonList,
  SkeletonProgressCard,
  SkeletonFormSection,
  SkeletonScreen,
} from '../common/Skeleton';

/**
 * One skeleton per view, each mirroring the real layout of the view it stands in
 * for. The point is that the page does not reflow when data lands — a generic
 * spinner followed by a full render is exactly the jump these replace.
 */

export const DashboardSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading dashboard">
    <SkeletonStatGrid count={4} />

    {/* Recent activity panel */}
    <div className="rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 p-6">
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-20" delay={1} />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-700/30 last:border-0">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" delay={i % 5} />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-2/5" delay={i % 5} />
              <Skeleton className="h-3 w-1/4" delay={i % 5} />
            </div>
            <Skeleton className="h-6 w-20 rounded-full shrink-0" delay={i % 5} />
          </div>
        ))}
      </div>
    </div>
  </SkeletonScreen>
);

export const AssetsSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading assets">
    <SkeletonPageHeader />
    <div className="flex gap-3">
      <Skeleton className="h-10 flex-1 rounded-xl" />
      <Skeleton className="h-10 w-32 rounded-xl" delay={1} />
    </div>
    <SkeletonList rows={6} />
  </SkeletonScreen>
);

export const TransactionsSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading transactions">
    <SkeletonPageHeader />
    {/* Status filter tabs */}
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-lg" delay={i} />
      ))}
    </div>
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/40 space-y-3"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" delay={i % 5} />
              <div className="space-y-2 min-w-0">
                <Skeleton className="h-4 w-40" delay={i % 5} />
                <Skeleton className="h-3 w-56" delay={i % 5} />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full shrink-0" delay={i % 5} />
          </div>
          {/* Approval progress */}
          <Skeleton className="h-2 w-full rounded-full" delay={i % 5} />
        </div>
      ))}
    </div>
  </SkeletonScreen>
);

export const MembersSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading members">
    <SkeletonPageHeader />
    <SkeletonStatGrid count={3} />
    <Skeleton className="h-10 w-full rounded-xl" />
    <SkeletonList rows={5} />
  </SkeletonScreen>
);

export const ContactsSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading contacts">
    <SkeletonPageHeader />
    <Skeleton className="h-10 w-full rounded-xl" />
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/40 flex items-center gap-3"
        >
          <Skeleton className="h-10 w-10 rounded-full shrink-0" delay={i % 5} />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-24" delay={i % 5} />
            <Skeleton className="h-3 w-32" delay={i % 5} />
          </div>
        </div>
      ))}
    </div>
  </SkeletonScreen>
);

/** Shared by Locks and Vesting — both render badge/progress/metadata cards. */
const DisbursementSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <SkeletonScreen label={label}>
    <SkeletonPageHeader />
    <SkeletonStatGrid count={3} />
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 rounded-lg" delay={i} />
      ))}
    </div>
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonProgressCard key={i} delay={i % 5} />
      ))}
    </div>
  </SkeletonScreen>
);

export const LocksSkeleton: React.FC = () => <DisbursementSkeleton label="Loading time locks" />;
export const VestingSkeleton: React.FC = () => (
  <DisbursementSkeleton label="Loading vesting schedules" />
);

export const SettingsSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading settings">
    <SkeletonPageHeader action={false} />
    <div className="grid lg:grid-cols-2 gap-6">
      <SkeletonFormSection fields={3} />
      <SkeletonFormSection fields={2} delay={1} />
      <SkeletonFormSection fields={4} delay={2} />
      <SkeletonFormSection fields={2} delay={3} />
    </div>
  </SkeletonScreen>
);

export const AdminSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading admin panel">
    <SkeletonPageHeader action={false} />
    <SkeletonStatGrid count={3} />
    <div className="grid lg:grid-cols-2 gap-6">
      <SkeletonFormSection fields={3} />
      <SkeletonFormSection fields={3} delay={1} />
    </div>
  </SkeletonScreen>
);

export const DocsSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading documentation">
    <div className="flex gap-8">
      {/* Table of contents */}
      <div className="hidden lg:block w-56 shrink-0 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i % 3 === 0 ? 'w-full' : 'w-4/5'}`} delay={i % 5} />
        ))}
      </div>
      <div className="flex-1 min-w-0 space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <SkeletonText lines={4} />
        <Skeleton className="h-40 w-full rounded-xl" delay={2} />
        <SkeletonText lines={5} />
        <SkeletonText lines={3} />
      </div>
    </div>
  </SkeletonScreen>
);

export const FiatSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading fiat on-ramp">
    <SkeletonPageHeader action={false} />
    <div className="max-w-xl mx-auto w-full">
      <SkeletonFormSection fields={3} />
      <Skeleton className="h-12 w-full rounded-xl mt-6" delay={3} />
    </div>
  </SkeletonScreen>
);

/** Shown before a vault is selected, while the user's vault list is fetched. */
export const VaultListSkeleton: React.FC = () => (
  <SkeletonScreen label="Loading your vaults">
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-7 w-56 mb-2" />
        <Skeleton className="h-4 w-72" delay={1} />
      </div>
      <Skeleton className="h-10 w-40 rounded-xl" delay={2} />
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="p-6 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 space-y-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" delay={i % 5} />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-28" delay={i % 5} />
              <Skeleton className="h-3 w-36" delay={i % 5} />
            </div>
          </div>
          <Skeleton className="h-7 w-32" delay={i % 5} />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" delay={i % 5} />
            <Skeleton className="h-5 w-20 rounded-full" delay={i % 5} />
          </div>
        </div>
      ))}
    </div>
  </SkeletonScreen>
);

const VIEW_SKELETONS: Record<ActiveView, React.FC> = {
  dashboard: DashboardSkeleton,
  assets: AssetsSkeleton,
  transactions: TransactionsSkeleton,
  members: MembersSkeleton,
  contacts: ContactsSkeleton,
  admin: AdminSkeleton,
  settings: SettingsSkeleton,
  locks: LocksSkeleton,
  vesting: VestingSkeleton,
  docs: DocsSkeleton,
  fiat: FiatSkeleton,
};

/**
 * Renders the skeleton matching the view the user is currently on, so the
 * placeholder always has the shape of the content that is about to replace it.
 */
export const ViewSkeleton: React.FC<{ view: ActiveView }> = ({ view }) => {
  const Component = VIEW_SKELETONS[view] ?? DashboardSkeleton;
  return <Component />;
};
