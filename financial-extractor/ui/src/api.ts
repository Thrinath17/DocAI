import type { UploadResponse, JobStatusResponse } from './types';

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error((err as { detail?: string }).detail ?? 'Upload failed');
  }
  return res.json() as Promise<UploadResponse>;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
  return res.json() as Promise<JobStatusResponse>;
}

export async function getResult(jobId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/results/${jobId}`);
  if (!res.ok) throw new Error(`Result fetch failed: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function reprocessJob(jobId: string): Promise<void> {
  const res = await fetch(`/jobs/${jobId}/reprocess`, { method: 'POST' });
  if (!res.ok) throw new Error(`Reprocess failed: ${res.status}`);
}
