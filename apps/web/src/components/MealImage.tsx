'use client';
// Photo from the manifest; deterministic colour tile when the entry or file is missing (never a broken image).
import Image from 'next/image';
import { useState } from 'react';
import type { Meal } from '@meal/core';
import { imageFor } from '@/content/images';

const TILE = ['#C9971F', '#B5793A', '#A23E22', '#3E7D2E', '#B7791F', '#7A5AA8', '#2F8F83', '#C2410C'];
const tileFor = (id: string) => TILE[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TILE.length];

export function MealImage({ meal, height, width = '100%', rounded = 0 }: { meal: Meal; height: number; width?: number | '100%'; rounded?: number }) {
  const entry = imageFor(meal.id);
  const [failed, setFailed] = useState(false);
  const box = { position: 'relative' as const, width, height, borderRadius: rounded, overflow: 'hidden', flex: 'none' as const };
  if (!entry || failed) {
    return (
      <div data-testid="meal-image-fallback" style={{ ...box, background: tileFor(meal.id), display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
        <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: Math.round(height * 0.4), opacity: 0.92 }}>{meal.name.charAt(0)}</span>
      </div>
    );
  }
  const sizes = typeof width === 'number' ? `${width}px` : '(min-width: 992px) 640px, 100vw';
  return (
    <div style={box}>
      <Image src={`/meals/${entry.file}`} alt={meal.name} fill sizes={sizes} style={{ objectFit: 'cover' }} onError={() => setFailed(true)} />
    </div>
  );
}
