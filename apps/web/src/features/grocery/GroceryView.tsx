'use client';
import { useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import ProgressBar from 'react-bootstrap/ProgressBar';
import { buildGroceryList, planKey, toISODate, weekDates, weekStart } from '@meal/core';
import { mealById, vocab } from '@/content';
import { Loading, PageHeader } from '@/ui';
import { useHousehold } from '../useHousehold';

export function GroceryView() {
  const { data, members } = useHousehold();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    if (!data) return [];
    const start = weekStart(toISODate(new Date()), data.settings.weekStartsOn);
    const entries = weekDates(start).flatMap((d) => data.settings.enabledSlots.map((s) => data.plan[planKey(d, s)]).filter(Boolean));
    return buildGroceryList(entries.filter((e) => e.status === 'planned'), mealById, vocab, { servings: Math.max(1, members.length), pantry: new Set(data.pantry) });
  }, [data, members.length]);
  if (!data) return <Loading />;
  const lines = groups.flatMap((g) => g.lines);
  const isChecked = (id: string, inPantry: boolean) => checked.has(id) !== inPantry; // pantry items start ticked
  const done = lines.filter((l) => isChecked(l.ingredientId, l.inPantry)).length;
  const copy = () => {
    const text = groups.map((g) => `${g.label}\n` + g.lines.filter((l) => !isChecked(l.ingredientId, l.inPantry)).map((l) => `- ${l.label} ${l.display}`).join('\n')).join('\n\n');
    // Clipboard API needs a secure context; fall back to a hidden textarea (design §9.6).
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    else { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  };
  return (
    <div className="d-flex flex-column gap-3" style={{ maxWidth: 640 }}>
      <PageHeader eyebrow="For this week's plan" title="Grocery list" action={<Button variant="outline-primary" onClick={copy} disabled={!lines.length}>Copy list</Button>} />
      {!lines.length ? <div className="mr-card">Plan the week first. The list is built from it.</div> : (
        <>
          <div className="mr-card d-flex flex-column gap-2">
            <div className="d-flex justify-content-between"><span className="fw-bold">{done} of {lines.length} items</span><span className="small text-secondary">Merged across the week · {members.length} servings</span></div>
            <ProgressBar now={(done / lines.length) * 100} style={{ height: 8 }} />
          </div>
          {groups.map((g) => (
            <section key={g.category} className="d-flex flex-column gap-2">
              <div className="mr-eyebrow px-1">{g.label}</div>
              <div className="mr-list">
                {g.lines.map((l) => {
                  const c = isChecked(l.ingredientId, l.inPantry);
                  return (
                    <label key={l.ingredientId} className="mr-row" style={{ cursor: 'pointer' }} title={l.meals.join(', ')}>
                      <input type="checkbox" checked={c} onChange={() => { const n = new Set(checked); n.has(l.ingredientId) ? n.delete(l.ingredientId) : n.add(l.ingredientId); setChecked(n); }} style={{ width: 22, height: 22, accentColor: 'var(--mr-primary)' }} />
                      <span className="flex-fill" style={c ? { textDecoration: 'line-through', color: 'var(--mr-muted)' } : undefined}>{l.label}{l.inPantry && <span className="small text-secondary"> · at home</span>}</span>
                      <span className="small text-secondary">{l.display}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
