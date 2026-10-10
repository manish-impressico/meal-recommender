'use client';
// Domain-free primitives (design §9.2). The only place that imports react-bootstrap — a design-system swap stays local.
import Dropdown from 'react-bootstrap/Dropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Spinner from 'react-bootstrap/Spinner';
import type { ReactNode } from 'react';
import { IconChevronDown } from './icons';

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <header className="d-flex align-items-center justify-content-between gap-3 pt-3 pb-2">
      <div>
        <div className="mr-eyebrow">{eyebrow}</div>
        <h1 className="m-0 fw-bold" style={{ fontSize: 26, lineHeight: 1.15 }}>{title}</h1>
      </div>
      {action}
    </header>
  );
}

/** One sheet for Not-this, Pantry and Swap. */
export function BottomSheet({ show, onHide, title, subtitle, children, footer }: {
  show: boolean; onHide: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <Offcanvas show={show} onHide={onHide} placement="bottom" className="mr-sheet">
      <Offcanvas.Header closeButton>
        <div>
          <Offcanvas.Title as="h2" className="fs-5 fw-bold m-0">{title}</Offcanvas.Title>
          {subtitle && <div className="small text-secondary">{subtitle}</div>}
        </div>
      </Offcanvas.Header>
      <Offcanvas.Body className="d-flex flex-column gap-3">
        {children}
        {footer && <div className="d-grid gap-2">{footer}</div>}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export type ChipState = 'off' | 'on' | 'like' | 'dislike';
/** One chip for slot picker, context chips, pantry, reasons and tri-state tastes. Parameterized, not forked. */
export function Chip({ label, state, onClick, title }: { label: ReactNode; state: ChipState; onClick: () => void; title?: string }) {
  return (
    <button type="button" className="mr-chip" aria-pressed={state === 'on' || state === 'like'} data-state={state} onClick={onClick} title={title}>
      {label}
    </button>
  );
}

export function ChipGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="d-flex flex-column gap-2">
      {label && <div className="mr-eyebrow">{label}</div>}
      <div className="d-flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return <div className="d-flex align-items-center gap-2 py-4 text-secondary"><Spinner size="sm" /> {text}</div>;
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn'; children: ReactNode }) {
  return <span className={`mr-badge ${tone ?? ''}`}>{children}</span>;
}

/** Compact single-select menu ("Dinner ▾"). Replaces rows of chips where only one value matters. */
export function SlotPicker<T extends string>({ value, options, onChange, label = 'Meal' }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label?: string;
}) {
  const current = options.find((o) => o.id === value)?.label ?? value;
  return (
    <Dropdown align="end" onSelect={(k) => k && onChange(k as T)}>
      <Dropdown.Toggle as="button" type="button" className="mr-chip d-inline-flex align-items-center gap-2" aria-label={`${label}: ${current}`} bsPrefix="mr-noarrow">
        {current}<IconChevronDown size={16} aria-hidden="true" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {options.map((o) => <Dropdown.Item key={o.id} eventKey={o.id} active={o.id === value}>{o.label}</Dropdown.Item>)}
      </Dropdown.Menu>
    </Dropdown>
  );
}
