import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Job } from '../types';
import { downloadJson, downloadCsv } from '../utils/download';
import * as Icons from './icons';

// ── JSON tree renderer ────────────────────────────────────────────────────────
function fmtNumber(v: number): string {
  const sign = v < 0 ? '−' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US')}`;
}

// True only if the value is a plain object whose direct values are all primitives (no arrays, no nested objects).
function isShallow(v: unknown): boolean {
  if (v === null || v === undefined || typeof v !== 'object') return true;
  if (Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every(
    val => val === null || val === undefined || typeof val !== 'object'
  );
}

// Candidate keys for extracting a human label / numeric value from a leaf object.
const LABEL_KEYS = ['label', 'name', 'item_name', 'account_name', 'total_name', 'description', 'account', 'item', 'title', 'line_item', 'field'];
const VALUE_KEYS = ['value', 'amount', 'balance', 'total', 'current', 'current_year', 'figure'];

// Keys that name a section — skip rendering them as rows since they're already used as the section header.
const SECTION_KEYS = ['name', 'label', 'title', 'section', 'section_name', 'category', 'group'];

// Array-valued keys whose contents should be rendered inline (no wrapper label shown).
const INLINE_ARRAY_KEYS = ['items', 'line_items', 'entries', 'rows', 'data', 'fields', 'components', 'sections'];

function sectionLabel(obj: Record<string, unknown>, fallback: number): string {
  for (const k of SECTION_KEYS) {
    if (typeof obj[k] === 'string' && (obj[k] as string).trim()) return obj[k] as string;
  }
  return String(fallback);
}

// Render a shallow object as one or more leaf rows (no caret).
function ShallowRows({ obj }: { obj: Record<string, unknown> }) {
  // If it matches a label+value pattern, render as a single clean row.
  const lKey = LABEL_KEYS.find(k => typeof obj[k] === 'string');
  const vKey = VALUE_KEYS.find(k => k in obj);
  if (lKey && vKey) {
    return <LeafRow label={String(obj[lKey])} value={obj[vKey]} />;
  }
  // Otherwise render every key as its own row, skipping structural label keys.
  return (
    <>
      {Object.entries(obj)
        .filter(([k]) => !SECTION_KEYS.includes(k))
        .map(([k, v]) => (
          <LeafRow key={k} label={k} value={v} />
        ))}
    </>
  );
}

function LeafRow({ label, value }: { label: string; value: unknown }) {
  const isNull = value === null || value === undefined;
  const isNum  = typeof value === 'number';
  const display = isNull ? '—' : isNum ? fmtNumber(value as number) : String(value);
  return (
    <div className="tree-leaf">
      <span className={`leaf-label ${isNull ? 'muted' : ''}`}>{label}</span>
      <span className={`leaf-value ${isNull ? 'null-val' : isNum ? 'number' : ''}`}>{display}</span>
    </div>
  );
}

function SectionNode({ label, value, level }: { label: string; value: unknown; level: number }) {
  if (value === null || value === undefined || typeof value !== 'object') {
    return <LeafRow label={label} value={value} />;
  }

  const children = Array.isArray(value)
    ? renderArrayChildren(value as unknown[], level)
    : renderObjectChildren(value as Record<string, unknown>, level);

  return (
    <div className="tree-node">
      <div className="tree-header open">
        <span className={`tree-label level-${Math.min(level, 3)}`}>{label}</span>
      </div>
      <div className="tree-children">{children}</div>
    </div>
  );
}

// Render the children of an array.
function renderArrayChildren(arr: unknown[], level: number): React.ReactNode {
  return arr.map((item, i) => {
    if (item === null || item === undefined || typeof item !== 'object' || Array.isArray(item)) {
      return <LeafRow key={i} label={String(i)} value={item} />;
    }
    const obj = item as Record<string, unknown>;
    // Shallow item → flat leaf rows (no caret).
    if (isShallow(obj)) {
      return <ShallowRows key={i} obj={obj} />;
    }
    // Deep item → collapsible child section.
    return <SectionNode key={i} label={sectionLabel(obj, i)} value={obj} level={level + 1} />;
  });
}

// Render the children of an object.
function renderObjectChildren(obj: Record<string, unknown>, level: number): React.ReactNode {
  return Object.entries(obj).map(([k, v]) => {
    // Skip section-name keys — already used as the section header above this node.
    if (SECTION_KEYS.includes(k) && typeof v === 'string') return null;

    if (v === null || v === undefined || typeof v !== 'object') {
      return <LeafRow key={k} label={k} value={v} />;
    }
    // Inline array keys: render items directly without a "items" / "line_items" label.
    if (Array.isArray(v) && INLINE_ARRAY_KEYS.includes(k)) {
      return <React.Fragment key={k}>{renderArrayChildren(v, level)}</React.Fragment>;
    }
    if (!Array.isArray(v) && isShallow(v)) {
      return <ShallowRows key={k} obj={v as Record<string, unknown>} />;
    }
    return <SectionNode key={k} label={k} value={v} level={level + 1} />;
  });
}

function countLeaves(v: unknown): number {
  if (v === null || v === undefined || typeof v !== 'object') return 1;
  if (Array.isArray(v)) return (v as unknown[]).reduce((s, item) => s + countLeaves(item), 0);
  return Object.values(v as Record<string, unknown>).reduce((s, item) => s + countLeaves(item), 0);
}

// Keys consumed by the modal header — suppress them from the body tree.
const HEADER_KEYS = new Set([
  'company_name', 'company', 'entity_name',
  'document_type', 'doc_type',
  'reporting_period', 'period',
  'currency',
  'metadata',
]);

function ResultTree({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="tree">
      {Object.entries(result)
        .filter(([k]) => !HEADER_KEYS.has(k))
        .map(([k, v]) => {
          if (v === null || v === undefined || typeof v !== 'object') {
            return <LeafRow key={k} label={k} value={v} />;
          }
          if (Array.isArray(v) && INLINE_ARRAY_KEYS.includes(k)) {
            return <React.Fragment key={k}>{renderArrayChildren(v, 1)}</React.Fragment>;
          }
          if (!Array.isArray(v) && isShallow(v)) {
            return <ShallowRows key={k} obj={v as Record<string, unknown>} />;
          }
          return <SectionNode key={k} label={k} value={v} level={1} />;
        })}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface Props {
  job: Job;
  onClose: () => void;
  onReprocess: () => void;
}

export default function ViewModal({ job, onClose, onReprocess }: Props) {
  const [dlOpen, setDlOpen] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const result = job.result ?? {};
  const meta = (typeof result.metadata === 'object' && result.metadata !== null)
    ? result.metadata as Record<string, unknown>
    : {} as Record<string, unknown>;

  const PLACEHOLDER = /^(unknown|n\/a|none|null|undefined|-)$/i;
  const meaningful = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s && !PLACEHOLDER.test(s) ? s : '';
  };

  const company =
    meaningful(result.company_name ?? result.company ?? result.entity_name
      ?? meta.company_name ?? meta.company ?? meta.entity_name) || '';
  const docType =
    meaningful(result.document_type ?? result.doc_type
      ?? meta.document_type ?? meta.doc_type) || '';
  const period =
    meaningful(result.reporting_period ?? result.period
      ?? meta.reporting_period ?? meta.period) || '';
  const currency =
    meaningful(result.currency ?? meta.currency) || '';

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={e => e.target === backdropRef.current && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Result: ${job.filename}`}>
        <div className="modal-header">
          <div className="modal-filename">{job.filename}</div>
          {company && <h2 className="modal-company">{company}</h2>}
          {(docType || period || currency) && (
            <div className="modal-meta">
              {[
                docType  && <span key="dt">{docType}</span>,
                period   && <span key="pr">{period}</span>,
                currency && <span key="cy">{currency}</span>,
              ].filter(Boolean).reduce<React.ReactNode[]>((acc, el, i) => (
                i === 0 ? [el] : [...acc, <span key={`sep${i}`} className="sep">·</span>, el]
              ), [])}
            </div>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icons.X size={14} />
          </button>
        </div>

        <div className="modal-body">
          {Object.keys(result).length > 0
            ? <ResultTree result={result} />
            : (
              <p style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                No result data available.
              </p>
            )
          }
        </div>

        <div className="modal-footer">
          <div className="modal-footer-meta">
            Extracted · {countLeaves(result)} fields
          </div>
          <div className="modal-footer-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => { onReprocess(); onClose(); }}>
              <Icons.Refresh size={13} /> Reprocess
            </button>
            <div className="menu-anchor">
              <div className="split">
                <button className="btn btn-sm" onClick={() => downloadJson(result, `${job.id}.json`)}>
                  <Icons.Download size={13} /> Download
                </button>
                <button className="btn btn-sm split-caret" onClick={() => setDlOpen(o => !o)} aria-label="More download options">
                  <Icons.ChevronDown size={11} />
                </button>
              </div>
              {dlOpen && (
                <div className="menu">
                  <button className="menu-item" onClick={() => { downloadJson(result, `${job.id}.json`); setDlOpen(false); }}>
                    <Icons.Download size={13} /> Download JSON
                  </button>
                  <button className="menu-item" onClick={() => { downloadCsv(result, `${job.id}.csv`); setDlOpen(false); }}>
                    <Icons.Download size={13} /> Download CSV
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
