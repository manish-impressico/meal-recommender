'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { buildContext, useAppData, useProjection } from '@/data/store';

/** Shared feature hook: data + projection + request context, and first-run redirect. */
export function useHousehold({ requireOnboarded = true } = {}) {
  const data = useAppData();
  const proj = useProjection(data);
  const router = useRouter();
  useEffect(() => {
    if (requireOnboarded && data && !data.settings.onboarded) router.replace('/onboarding');
  }, [data, requireOnboarded, router]);
  const context = data && proj ? buildContext(data, proj) : null;
  return { data, proj, context, members: data?.members.filter((m) => m.active) ?? [] };
}
