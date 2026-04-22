import JSZip from 'jszip';
import type { Job } from '../types';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}

function flattenObject(obj: unknown, prefix = ''): Record<string, string> {
  if (obj === null || obj === undefined) {
    return prefix ? { [prefix]: '' } : {};
  }
  if (typeof obj !== 'object') {
    return prefix ? { [prefix]: String(obj) } : {};
  }
  if (Array.isArray(obj)) {
    const out: Record<string, string> = {};
    (obj as unknown[]).forEach((item, i) => {
      Object.assign(out, flattenObject(item, prefix ? `${prefix}[${i}]` : String(i)));
    });
    return out;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    Object.assign(out, flattenObject(v, key));
  }
  return out;
}

function toCsv(rows: string[][]): string {
  return rows
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadCsv(data: unknown, filename: string) {
  const flat = flattenObject(data);
  const rows: string[][] = [['field', 'value'], ...Object.entries(flat)];
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export async function downloadZip(jobs: Job[]) {
  const zip = new JSZip();
  for (const job of jobs) {
    if (job.result) {
      zip.file(`${job.id}_${job.filename}.json`, JSON.stringify(job.result, null, 2));
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, 'docai-results.zip');
}

export async function downloadMergedCsv(jobs: Job[]) {
  const jobsWithResults = jobs.filter(j => j.result);
  if (jobsWithResults.length === 0) return;

  const allFlattened = jobsWithResults.map(j => flattenObject(j.result));
  const allKeys = Array.from(new Set(allFlattened.flatMap(f => Object.keys(f))));
  const headers = ['source_file', ...allKeys];

  const rows: string[][] = [headers];
  jobsWithResults.forEach((job, i) => {
    rows.push([job.filename, ...allKeys.map(k => allFlattened[i][k] ?? '')]);
  });

  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, 'docai-merged.csv');
}
