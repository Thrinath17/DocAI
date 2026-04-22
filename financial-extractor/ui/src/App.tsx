import { useState, useEffect, useCallback } from 'react';
import type { Job } from './types';
import { reprocessJob } from './api';
import { useJobPolling } from './hooks/useJobPolling';
import DropZone from './components/DropZone';
import JobsTable from './components/JobsTable';
import ViewModal from './components/ViewModal';
import { Sun, Moon } from './components/icons';

const JOBS_KEY  = 'docai-jobs';
const THEME_KEY = 'docai-theme';

function loadJobs(): Job[] {
  try {
    return JSON.parse(localStorage.getItem(JOBS_KEY) ?? '[]') as Job[];
  } catch {
    return [];
  }
}

function saveJobs(jobs: Job[]) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export default function App() {
  const [jobs, setJobs] = useState<Job[]>(loadJobs);
  const [selected, setSelected] = useState<string[]>([]);
  const [modalJobId, setModalJobId] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem(THEME_KEY) === 'midnight');

  // Apply theme
  useEffect(() => {
    document.body.classList.toggle('theme-dark', dark);
    localStorage.setItem(THEME_KEY, dark ? 'midnight' : 'slate');
  }, [dark]);

  // Persist jobs
  useEffect(() => { saveJobs(jobs); }, [jobs]);

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(js => js.map(j => j.id === id ? { ...j, ...updates } : j));
  }, []);

  useJobPolling(jobs, updateJob);

  const handleJobsAdded = useCallback((newJobs: Job[]) => {
    setJobs(js => [...newJobs, ...js]);
  }, []);

  const modalJob = modalJobId ? jobs.find(j => j.id === modalJobId) : undefined;

  const handleReprocess = useCallback((job: Job) => {
    reprocessJob(job.id).catch(() => {});
    setJobs(js => js.map(j =>
      j.id === job.id
        ? { ...j, status: 'queued', error: undefined, result: undefined }
        : j,
    ));
  }, []);

  return (
    <>
      <div className="bg-gradient" aria-hidden="true" />

      <div className="page">
        <header className="masthead">
          <div className="brand-row">
            <div className="brand-lockup">
              <div className="brand-mark" aria-label="DocAI logo">
                <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M7 4.5A1.5 1.5 0 0 1 8.5 3H19L25 9V27.5A1.5 1.5 0 0 1 23.5 29H8.5A1.5 1.5 0 0 1 7 27.5Z"
                    fill="rgba(255,255,255,0.95)"
                  />
                  <path
                    d="M19 3V9H25"
                    fill="rgba(255,255,255,0.55)"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                  <path d="M16 14.5L18.5 18.5L16 22.5L13.5 18.5Z" fill="#ff4a10" />
                  <circle cx="20.5" cy="15" r="1" fill="#ff4a10" />
                  <circle cx="11.5" cy="22" r="1" fill="#ff4a10" />
                </svg>
              </div>
              <div className="brand-word">
                <span>Doc</span>
                <span className="dot" aria-hidden="true" />
                <span className="ai">AI</span>
              </div>
            </div>

            <button
              className="theme-toggle"
              onClick={() => setDark(d => !d)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <h1>
            Extract structured data
            <br />
            <span style={{ fontWeight: 300 }}>from financial documents.</span>
          </h1>

          <div className="masthead-meta">
            <span className="status-dot" />
            <span>EXTRACTION ENGINE · ONLINE</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>LOCAL · NO DATA LEAVES YOUR MACHINE</span>
          </div>
        </header>

        <DropZone onJobsAdded={handleJobsAdded} />

        <JobsTable
          jobs={jobs}
          setJobs={setJobs}
          selected={selected}
          setSelected={setSelected}
          onViewJob={setModalJobId}
        />

        <footer className="footer-tag">
          DOCAI · LOCAL EXTRACTION · SOC 2 TYPE II · YOUR DATA NEVER LEAVES THE TENANT
        </footer>
      </div>

      {modalJob && (
        <ViewModal
          job={modalJob}
          onClose={() => setModalJobId(null)}
          onReprocess={() => handleReprocess(modalJob)}
        />
      )}
    </>
  );
}
