import { useEffect, useRef } from 'react';
import type { Job } from '../types';
import { getJobStatus, getResult } from '../api';

const TERMINAL = new Set<string>(['completed', 'failed']);

export function useJobPolling(
  jobs: Job[],
  onJobUpdate: (id: string, updates: Partial<Job>) => void,
) {
  const jobsRef = useRef(jobs);
  const onUpdateRef = useRef(onJobUpdate);

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { onUpdateRef.current = onJobUpdate; }, [onJobUpdate]);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;
      const active = jobsRef.current.filter(j => !TERMINAL.has(j.status));
      if (active.length === 0) return;

      await Promise.all(active.map(async (job) => {
        try {
          const statusRes = await getJobStatus(job.id);
          if (!mounted) return;

          const updates: Partial<Job> = {
            status: statusRes.status,
            error: statusRes.error ?? undefined,
            updatedAt: statusRes.updated_at,
          };

          if (statusRes.status === 'completed' && !job.result) {
            try {
              updates.result = await getResult(job.id);
            } catch {
              // result fetch failed; leave result undefined, job still shows completed
            }
          }

          onUpdateRef.current(job.id, updates);
        } catch {
          // network error; silently retry on next tick
        }
      }));
    };

    const id = setInterval(poll, 3000);
    poll();

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []); // refs keep this stable
}
