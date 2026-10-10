'use client';
import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import { planKey, planWeekTargets, swapTarget, toISODate, weekDates, weekStart, type PlanEntry, type SlotResult } from '@meal/core';
import { run } from '@/data/store';
import { getRecommendations } from '@/services/recommendClient';
import { mealById } from '@/content';
import { BottomSheet, Chip, Loading, PageHeader } from '@/ui';
import { MealCard, MealMeta } from '@/components';
import { useHousehold } from '../useHousehold';

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', o);

export function WeekView() {
  const { data, context } = useHousehold();
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(toISODate(new Date()));
  const [swap, setSwap] = useState<{ entry: PlanEntry; result: SlotResult | null } | null>(null);
  if (!data || !context) return <Loading />;

  const start = weekStart(toISODate(new Date()), data.settings.weekStartsOn);
  const dates = weekDates(start);
  const week = dates.flatMap((d) => data.settings.enabledSlots.map((s) => data.plan[planKey(d, s)]).filter(Boolean)) as PlanEntry[];

  const generate = async () => {
    setBusy(true);
    const targets = planWeekTargets(start, data.settings.enabledSlots, week);
    const keep = week.filter((e) => e.status === 'cooked' || e.source === 'manual');
    const res = await getRecommendations({ targets: targets.map((t) => ({ ...t, excludeIds: keep.map((k) => k.mealId) })), context });
    run({ type: 'acceptPlan', entries: res.results.filter((r) => r.pick).map((r) => ({ date: r.date, slot: r.slot, mealId: r.pick!.mealId, status: 'planned', source: r.source, reason: r.pick!.reason })) });
    setBusy(false);
  };
  const openSwap = async (entry: PlanEntry) => {
    setSwap({ entry, result: null });
    let res = await getRecommendations({ targets: [swapTarget(entry, week)], context });
    // Small catalog: if no unused meal fits this slot, allow a repeat rather than show nothing.
    if (res.results[0].noEligible) res = await getRecommendations({ targets: [{ ...swapTarget(entry, []), excludeIds: [entry.mealId] }], context });
    setSwap({ entry, result: res.results[0] });
  };

  const dayEntries = data.settings.enabledSlots.map((s) => ({ s, e: data.plan[planKey(day, s)] }));
  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader eyebrow="This week" title={`${fmt(dates[0], { weekday: 'short', day: 'numeric' })} – ${fmt(dates[6], { weekday: 'short', day: 'numeric', month: 'short' })}`}
        action={<Button onClick={generate} disabled={busy}>{busy ? 'Planning…' : week.length ? 'Regenerate' : 'Generate week'}</Button>} />
      <div className="d-flex gap-2 overflow-auto pb-1">
        {dates.map((d) => <Chip key={d} state={d === day ? 'on' : 'off'} label={fmt(d, { weekday: 'short', day: 'numeric' })} onClick={() => setDay(d)} />)}
      </div>
      {busy && <Loading text="Planning 7 days, no repeats…" />}
      {!week.length && !busy && <div className="mr-card">No plan yet. Generate one — every slot respects house rules and nobody’s won’t-eat list wins.</div>}
      <div className="d-grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {dayEntries.map(({ s, e }) => {
          const meal = e && mealById.get(e.mealId);
          return meal ? (
            <MealCard key={s} variant="compact" meal={meal} eyebrow={`${s}${e.status === 'cooked' ? ' · cooked' : ''}`} suggestion={{ mealId: meal.id, score: 0, reason: e.reason ?? '', verdicts: {} }} source={e.source}
              actions={e.status !== 'cooked' ? <Button variant="outline-primary" size="sm" onClick={() => openSwap(e)}>Swap</Button> : undefined} />
          ) : null;
        })}
      </div>
      <BottomSheet show={!!swap} onHide={() => setSwap(null)} title={`Swap ${swap?.entry.slot ?? ''}`} subtitle="Fits your household rules · not served this week">
        {!swap?.result && <Loading />}
        {[swap?.result?.pick, ...(swap?.result?.backups ?? [])].filter(Boolean).map((s) => {
          const m = mealById.get(s!.mealId)!;
          return (
            <div key={m.id} className="mr-list"><div className="mr-row">
              <div><div className="fw-bold">{m.name}</div><MealMeta meal={m} /><div className="small text-secondary">{s!.reason}</div></div>
              <Button variant="outline-primary" onClick={() => { run({ type: 'swap', date: swap!.entry.date, slot: swap!.entry.slot, fromMealId: swap!.entry.mealId, toMealId: m.id, reason: s!.reason, source: 'manual' }); setSwap(null); }}>Use this</Button>
            </div></div>
          );
        })}
      </BottomSheet>
    </div>
  );
}
