import { useState, useEffect, useCallback } from 'react';
import type { Job, Accuracy } from '../types';
import { reprocessJob } from '../api';
import {
  downloadJson, downloadCsv, downloadZip, downloadMergedCsv,
} from '../utils/download';
import * as Icons from './icons';

// ── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status, error }: { status: Job['status']; error?: string }) {
  const labels: Record<Job['status'], string> = {
    queued: 'Queued', running: 'Running', completed: 'Done', failed: 'Failed',
  };
  return (
    <span className={`pill ${status}`} title={error}>
      <span className="dot" />
      {labels[status]}
    </span>
  );
}

// ── Thumbs ───────────────────────────────────────────────────────────────────
function Thumbs({
  value, onChange, disabled,
}: { value: Accuracy; onChange: (v: Accuracy) => void; disabled: boolean }) {
  return (
    <div className="thumbs">
      <button
        className={`thumb-btn up ${value === 'up' ? 'active' : ''}`}
        onClick={() => !disabled && onChange(value === 'up' ? null : 'up')}
        disabled={disabled}
        aria-label="Accurate"
      >
        <Icons.ThumbUp size={14} />
      </button>
      <button
        className={`thumb-btn down ${value === 'down' ? 'active' : ''}`}
        onClick={() => !disabled && onChange(value === 'down' ? null : 'down')}
        disabled={disabled}
        aria-label="Inaccurate"
      >
        <Icons.ThumbDown size={14} />
      </button>
    </div>
  );
}

// ── Download split button ────────────────────────────────────────────────────
function DownloadSplit({
  job, openId, setOpenId,
}: { job: Job; openId: string | null; setOpenId: (id: string | null) => void }) {
  const key = `dl-${job.id}`;
  const open = openId === key;
  const enabled = job.status === 'completed' && !!job.result;

  const onJson = () => {
    downloadJson(job.result, `${job.id}.json`);
    setOpenId(null);
  };
  const onCsv = () => {
    downloadCsv(job.result, `${job.id}.csv`);
    setOpenId(null);
  };

  return (
    <div className="menu-anchor">
      <div className="split">
        <button
          className={`btn btn-primary btn-sm ${!enabled ? 'disabled' : ''}`}
          onClick={onJson}
          disabled={!enabled}
        >
          <Icons.Download size={13} /> JSON
        </button>
        <button
          className={`btn btn-primary btn-sm split-caret ${!enabled ? 'disabled' : ''}`}
          onClick={() => setOpenId(open ? null : key)}
          disabled={!enabled}
          aria-label="More download options"
        >
          <Icons.ChevronDown size={11} />
        </button>
      </div>
      {open && enabled && (
        <div className="menu">
          <button className="menu-item" onClick={onJson}>
            <Icons.Download size={13} /> Download JSON
          </button>
          <button className="menu-item" onClick={onCsv}>
            <Icons.Download size={13} /> Download CSV
          </button>
        </div>
      )}
    </div>
  );
}

// ── Actions menu ─────────────────────────────────────────────────────────────
function ActionsMenu({
  job, openId, setOpenId, onView, onReprocess, onRemove,
}: {
  job: Job;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onView: () => void;
  onReprocess: () => void;
  onRemove: () => void;
}) {
  const key = `act-${job.id}`;
  const open = openId === key;
  const isDone = job.status === 'completed' && !!job.result;

  return (
    <div className="menu-anchor">
      <button
        className={`icon-btn ${open ? 'active' : ''}`}
        onClick={() => setOpenId(open ? null : key)}
        aria-label="Row actions"
      >
        <Icons.Dots size={16} />
      </button>
      {open && (
        <div className="menu">
          {isDone && (
            <>
              <button className="menu-item" onClick={() => { onView(); setOpenId(null); }}>
                <Icons.FileText size={13} /> View result
              </button>
              <button className="menu-item" onClick={() => { downloadJson(job.result, `${job.id}.json`); setOpenId(null); }}>
                <Icons.Download size={13} /> Download JSON
              </button>
              <button className="menu-item" onClick={() => { downloadCsv(job.result, `${job.id}.csv`); setOpenId(null); }}>
                <Icons.Download size={13} /> Download CSV
              </button>
              <div className="menu-sep" />
            </>
          )}
          <button className="menu-item" onClick={() => { onReprocess(); setOpenId(null); }}>
            <Icons.Refresh size={13} /> Reprocess
          </button>
          <div className="menu-sep" />
          <button className="menu-item danger" onClick={() => { onRemove(); setOpenId(null); }}>
            <Icons.X size={13} /> Remove from list
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  onViewJob: (id: string) => void;
}

export default function JobsTable({ jobs, setJobs, selected, setSelected, onViewJob }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.menu-anchor')) setOpenMenu(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const toggleRow = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const toggleAll = () =>
    setSelected(selected.length === jobs.length ? [] : jobs.map(j => j.id));

  const setAccuracy = useCallback((id: string, val: Accuracy) =>
    setJobs(js => js.map(j => j.id === id ? { ...j, accuracy: val } : j)), [setJobs]);

  const handleReprocess = useCallback((job: Job) => {
    reprocessJob(job.id).catch(() => {});
    setJobs(js => js.map(j => j.id === job.id
      ? { ...j, status: 'queued', error: undefined, result: undefined }
      : j,
    ));
  }, [setJobs]);

  const handleRemove = useCallback((id: string) => {
    setJobs(js => js.filter(j => j.id !== id));
    setSelected(s => s.filter(x => x !== id));
  }, [setJobs, setSelected]);

  const handleBulkReprocess = () => {
    const toReprocess = jobs.filter(j => selected.includes(j.id));
    toReprocess.forEach(j => handleReprocess(j));
  };

  const handleBulkZip = () => {
    const toDownload = jobs.filter(j => selected.includes(j.id));
    downloadZip(toDownload).catch(() => {});
  };

  const handleBulkCsv = () => {
    const toDownload = jobs.filter(j => selected.includes(j.id));
    downloadMergedCsv(toDownload).catch(() => {});
  };

  const handleBulkClear = () => {
    setJobs(js => js.filter(j => !selected.includes(j.id)));
    setSelected([]);
  };

  const allSelected = jobs.length > 0 && selected.length === jobs.length;

  return (
    <div className="glass table-card">
      <div className="table-head-row">
        <div className="table-title">
          Jobs
          <span className="count">{jobs.length}</span>
        </div>
        <div className="table-tools">
          <div className="search" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--row-hover)', borderRadius: 'var(--radius-pill)', fontSize: 13, color: 'var(--text-muted)' }}>
            <Icons.Search size={13} />
            <span>Jobs</span>
          </div>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar">
          <div className="bulk-count">
            <span className="chip">{selected.length}</span>
            <span>selected</span>
            <span className="of">of {jobs.length} jobs</span>
          </div>
          <div className="bulk-actions">
            <button className="btn btn-sm" onClick={handleBulkZip}>
              <Icons.Archive size={13} /> Download ZIP
            </button>
            <button className="btn btn-sm" onClick={handleBulkCsv}>
              <Icons.Download size={13} /> Merged CSV
            </button>
            <button className="btn btn-sm" onClick={handleBulkReprocess}>
              <Icons.Refresh size={13} /> Reprocess
            </button>
            <button className="btn btn-sm" onClick={handleBulkClear}>
              <Icons.X size={13} /> Clear
            </button>
          </div>
        </div>
      )}

      <div className="table-scroll">
        <table className="jobs">
          <colgroup>
            <col className="col-check" />
            <col className="col-file" />
            <col className="col-status" />
            <col className="col-meta" />
            <col className="col-acc" />
            <col className="col-view" />
            <col className="col-dl" />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  className="check"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th>File</th>
              <th>Status</th>
              <th>Metadata</th>
              <th>Accuracy</th>
              <th>View</th>
              <th>Download</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  No jobs yet — drop files above to get started
                </td>
              </tr>
            ) : (
              jobs.map(job => {
                const isSelected = selected.includes(job.id);
                const isDone = job.status === 'completed';

                const meta = job.result
                  ? {
                      company: String(
                        (job.result as Record<string, unknown>).company_name
                        ?? (job.result as Record<string, unknown>).company
                        ?? ''
                      ) || null,
                      doc: String(
                        (job.result as Record<string, unknown>).document_type
                        ?? (job.result as Record<string, unknown>).doc_type
                        ?? ''
                      ) || null,
                      period: String(
                        (job.result as Record<string, unknown>).reporting_period
                        ?? (job.result as Record<string, unknown>).period
                        ?? ''
                      ) || null,
                    }
                  : null;

                return (
                  <tr key={job.id} className={isSelected ? 'selected' : ''}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        className="check"
                        checked={isSelected}
                        onChange={() => toggleRow(job.id)}
                      />
                    </td>
                    <td>
                      <div className="file-cell">
                        <div className="file-icon">{job.fileType}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="file-name">{job.filename}</div>
                          <div className={`file-sub ${job.status === 'failed' ? 'err' : ''}`}>
                            {job.fileSize}
                            {job.status === 'failed' && job.error && ` · ${job.error}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusPill status={job.status} error={job.error} />
                    </td>
                    <td>
                      {meta && (meta.company || meta.doc || meta.period) ? (
                        <span style={{ fontSize: 13 }}>
                          {meta.company && <span style={{ color: 'var(--text)' }}>{meta.company}</span>}
                          {meta.company && meta.doc && <span className="faint"> · </span>}
                          {meta.doc && <span className="muted">{meta.doc}</span>}
                          {meta.period && <><span className="faint"> · </span><span className="muted">{meta.period}</span></>}
                        </span>
                      ) : (
                        <span className="faint mono" style={{ fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td>
                      <Thumbs
                        value={job.accuracy}
                        onChange={v => setAccuracy(job.id, v)}
                        disabled={!isDone}
                      />
                    </td>
                    <td>
                      <button
                        className={`btn btn-ghost btn-sm ${!isDone ? 'disabled' : ''}`}
                        disabled={!isDone}
                        onClick={() => isDone && onViewJob(job.id)}
                      >
                        View <Icons.CaretRight size={11} />
                      </button>
                    </td>
                    <td>
                      <DownloadSplit job={job} openId={openMenu} setOpenId={setOpenMenu} />
                    </td>
                    <td>
                      <ActionsMenu
                        job={job}
                        openId={openMenu}
                        setOpenId={setOpenMenu}
                        onView={() => onViewJob(job.id)}
                        onReprocess={() => handleReprocess(job)}
                        onRemove={() => handleRemove(job.id)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
