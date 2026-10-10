'use client';
import { useCallback, useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import { planKey, summarizeVerdicts, toISODate, type RejectReason, type SlotResult, type Slot } from '@meal/core';
import { run } from '@/data/store';
import { getRecommendations } from '@/services/recommendClient';
import { mealById, vocab } from '@/content';
import { BottomSheet, Chip, ChipGroup, Loading, PageHeader, SlotPicker } from '@/ui';
import { IconClock, IconHome } from '@/ui/icons';
import { MealCard, MemberAvatar } from '@/components';
import { useHousehold } from '../useHousehold';

const SLOT_LABEL: Record<Slot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const TITLE: Record<Slot, string> = { breakfast: "Today's breakfast", lunch: "Today's lunch", snack: "Today's snack", dinner: "Tonight's pick" };
const REASONS: { id: RejectReason; label: string }[] = [
  { id: 'recent', label: 'Had it recently' }, { id: 'heavy', label: 'Too heavy' }, { id: 'no-time', label: 'No time tonight' }, { id: 'missing-ingredient', label: 'Missing an ingredient' },
];
const defaultSlot = (): Slot => { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner'; };

export function TodayView() {
  const { data, context, members } = useHousehold();
  const today = toISODate(new Date());
  const [slot, setSlot] = useState<Slot>(defaultSlot);
  const [quick, setQuick] = useState(false);
  const [result, setResult] = useState<SlotResult | null>(null);
  const [idx, setIdx] = useState(0); // walks pick → backups ("Show another" needs no new call)
  const [exclude, setExclude] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<'not' | 'pantry' | null>(null);
  const [vetoes, setVetoes] = useState<string[]>([]);
  const [reason, setReason] = useState<RejectReason | undefined>();
  const [pantryDraft, setPantryDraft] = useState<string[]>([]);

  const planned = data?.plan[planKey(today, slot)];
  const ctxKey = context ? JSON.stringify([context.pantry, context.blockedMealIds, context.members.length, context.settings.aiEnabled]) : '';

  const fetchPick = useCallback(async () => {
    if (!context) return;
    setLoading(true);
    const res = await getRecommendations({ targets: [{ date: today, slot, maxMinutes: quick ? 30 : undefined, excludeIds: exclude, backups: 5 }], context });
    setResult(res.results[0]);
    setIdx(0);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, slot, quick, exclude, today]);

  useEffect(() => { if (!planned || planned.status !== 'cooked') fetchPick(); }, [fetchPick, planned?.status]);

  if (!data || !context) return <Loading />;
  const options = result ? [result.pick, ...result.backups].filter(Boolean) as NonNullable<SlotResult['pick']>[] : [];
  const current = options[idx];
  const meal = planned?.status === 'cooked' ? mealById.get(planned.mealId) : current ? mealById.get(current.mealId) : undefined;

  const cook = () => current && run({ type: 'cookThis', date: today, slot, mealId: current.mealId, source: result!.source, reason: current.reason });
  const notThis = () => {
    if (!current) return;
    run({ type: 'notThis', date: today, slot, mealId: current.mealId, memberIds: vetoes, reason });
    setSheet(null); setVetoes([]); setReason(undefined);
    if (idx + 1 < options.length) setIdx(idx + 1); else setExclude([...exclude, ...options.map((o) => o.mealId)]);
  };
  const neverAgain = () => { if (!current) return; run({ type: 'blockMeal', mealId: current.mealId }); setSheet(null); };
  const otherSlots = data.settings.enabledSlots.filter((s) => s !== slot).map((s) => ({ s, e: data.plan[planKey(today, s)] })).filter((x) => x.e);

  return (
    <div className="d-flex flex-column gap-3" style={{ maxWidth: 640 }}>
      <PageHeader
        eyebrow={`${new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${SLOT_LABEL[slot]}`}
        title={TITLE[slot]}
        action={<SlotPicker value={slot} options={data.settings.enabledSlots.map((s) => ({ id: s, label: SLOT_LABEL[s] }))} onChange={(s) => { setSlot(s); setExclude([]); }} />}
      />
      <div className="d-flex gap-2 flex-wrap">
        <Chip state={quick ? 'on' : 'off'} onClick={() => setQuick(!quick)} label={<span className="d-inline-flex align-items-center gap-2"><IconClock size={16} aria-hidden="true" />Under 30 min</span>} />
        <Chip state={data.pantry.length ? 'on' : 'off'} onClick={() => { setPantryDraft(data.pantry); setSheet('pantry'); }}
          label={<span className="d-inline-flex align-items-center gap-2"><IconHome size={16} aria-hidden="true" />{data.pantry.length ? `At home · ${data.pantry.length}` : "Use what's at home"}</span>} />
      </div>

      {loading && !current && <Loading text="Finding a meal everyone will eat…" />}
      {planned?.status === 'cooked' && meal ? (
        <MealCard variant="hero" meal={meal} eyebrow={`${SLOT_LABEL[slot]} · cooked`} suggestion={{ mealId: meal.id, score: 0, reason: planned.reason ?? '', verdicts: {} }}
          badge={<span className="mr-badge ok">Cooked</span>} actions={<span className="small text-secondary">Enjoy! Plan ahead from the Week tab.</span>} />
      ) : result?.noEligible ? (
        <div className="mr-card">Nothing fits these filters. Try turning off “Under 30 min”.</div>
      ) : meal && current ? (
        <MealCard
          variant="hero" meal={meal} eyebrow={`${SLOT_LABEL[slot]} ${slot === 'dinner' ? 'tonight' : 'today'}`} suggestion={current} members={members} source={result!.source}
          showSource={data.settings.showDebug}
          badge={summarizeVerdicts(current.verdicts, members).everyoneHappy ? <span className="mr-badge highlight">Everyone&apos;s happy</span> : undefined}
          actions={<>
            <Button variant="outline-secondary" size="lg" className="flex-fill" onClick={() => setSheet('not')}>Not this</Button>
            <Button size="lg" className="flex-fill" style={{ flexGrow: 2 }} onClick={cook}>Cook this</Button>
          </>}
        />
      ) : null}

      {otherSlots.length > 0 && (
        <section className="d-flex flex-column gap-2">
          <h3 className="m-0" style={{ fontSize: 16 }}>Also today</h3>
          <div className="d-flex flex-column gap-2">
            {otherSlots.map(({ s, e }) => {
              const m = mealById.get(e!.mealId);
              return m ? <MealCard key={s} variant="compact" meal={m} eyebrow={`${SLOT_LABEL[s]} · ${e!.status}`} source={e!.source} showSource={data.settings.showDebug} /> : null;
            })}
          </div>
        </section>
      )}

      <BottomSheet show={sheet === 'not'} onHide={() => setSheet(null)} title={`Not ${meal?.name ?? 'this'}?`} subtitle="Optional: tell me why so tomorrow is smarter."
        footer={<><Button size="lg" onClick={notThis}>Show another</Button><Button variant="link" className="text-danger" onClick={neverAgain}>Never suggest this again</Button></>}>
        <ChipGroup label="Who won't eat it?">
          {members.map((m) => <Chip key={m.id} state={vetoes.includes(m.id) ? 'dislike' : 'off'} onClick={() => setVetoes(vetoes.includes(m.id) ? vetoes.filter((x) => x !== m.id) : [...vetoes, m.id])} label={<span className="d-inline-flex align-items-center gap-2"><MemberAvatar m={m} />{m.name}</span>} />)}
        </ChipGroup>
        <ChipGroup label="Or something else?">
          {REASONS.map((r) => <Chip key={r.id} state={reason === r.id ? 'on' : 'off'} label={r.label} onClick={() => setReason(reason === r.id ? undefined : r.id)} />)}
        </ChipGroup>
      </BottomSheet>

      <BottomSheet show={sheet === 'pantry'} onHide={() => setSheet(null)} title="What's at home?" subtitle="Tick what you have. Picks lean on these."
        footer={<><Button size="lg" onClick={() => { run({ type: 'setPantry', ingredientIds: pantryDraft }); setSheet(null); }}>Suggest with these {pantryDraft.length}</Button><Button variant="link" className="text-secondary" onClick={() => setPantryDraft([])}>Clear all</Button></>}>
        {vocab.data.categories.map((c) => {
          const items = vocab.pantryIngredients().filter((i) => i.category === c.id);
          if (!items.length) return null;
          return (
            <ChipGroup key={c.id} label={c.label}>
              {items.map((i) => <Chip key={i.id} state={pantryDraft.includes(i.id) ? 'on' : 'off'} label={i.label} onClick={() => setPantryDraft(pantryDraft.includes(i.id) ? pantryDraft.filter((x) => x !== i.id) : [...pantryDraft, i.id])} />)}
            </ChipGroup>
          );
        })}
      </BottomSheet>
    </div>
  );
}
