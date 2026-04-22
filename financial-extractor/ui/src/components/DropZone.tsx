import { useState, useRef, useCallback } from 'react';
import type { Job, StagedFile, FileType } from '../types';
import { uploadFile } from '../api';
import * as Icons from './icons';

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_BYTES = 50 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function mimeToFileType(mime: string): FileType {
  if (mime === 'image/jpeg') return 'JPG';
  if (mime === 'image/png') return 'PNG';
  return 'PDF';
}

interface Props {
  onJobsAdded: (jobs: Job[]) => void;
}

export default function DropZone({ onJobsAdded }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const uidRef = useRef(1);

  const addFiles = useCallback((files: File[]) => {
    const toAdd: StagedFile[] = [];
    const errors: string[] = [];

    for (const f of files) {
      if (!ALLOWED_TYPES.has(f.type)) {
        errors.push(`${f.name}: unsupported type (PDF, JPG, PNG only)`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        errors.push(`${f.name}: exceeds 50 MB limit`);
        continue;
      }
      toAdd.push({ uid: uidRef.current++, file: f, name: f.name, size: formatSize(f.size) });
    }

    if (toAdd.length) setStaged(s => [...s, ...toAdd]);
    if (errors.length) setUploadErrors(errors);
  }, []);

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleInnerClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const remove = (uid: number) => setStaged(s => s.filter(f => f.uid !== uid));

  const handleUpload = async () => {
    setUploading(true);
    setUploadErrors([]);

    const results = await Promise.allSettled(staged.map(sf => uploadFile(sf.file)));
    const newJobs: Job[] = [];
    const errors: string[] = [];
    const now = new Date().toISOString();

    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        newJobs.push({
          id: res.value.job_id,
          filename: staged[i].name,
          fileSize: staged[i].size,
          fileType: mimeToFileType(staged[i].file.type),
          status: 'queued',
          createdAt: now,
          updatedAt: now,
          accuracy: null,
        });
      } else {
        const msg = res.reason instanceof Error ? res.reason.message : 'Upload failed';
        errors.push(`${staged[i].name}: ${msg}`);
      }
    });

    if (newJobs.length) onJobsAdded(newJobs);
    if (errors.length) setUploadErrors(errors);
    setStaged([]);
    setUploading(false);
  };

  const LIMIT = 12; // 4 cols × 3 rows
  const showAll = expanded || staged.length <= LIMIT;
  const shown = showAll ? staged : staged.slice(0, LIMIT - 1);
  const hiddenCount = staged.length - shown.length;

  return (
    <div
      className={`glass dropzone ${dragOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      <div className="dropzone-inner" onClick={handleInnerClick}>
        <div className="upload-icon">
          <Icons.UploadCloud size={44} />
        </div>
        <div className="dropzone-primary">
          Drop files here or <span className="browse">click to browse</span>
        </div>
        <div className="dropzone-secondary">
          PDF, JPG, PNG · Max 50 MB each
        </div>

        {uploadErrors.length > 0 && (
          <div className="upload-errors" onClick={e => e.stopPropagation()}>
            {uploadErrors.map((err, i) => (
              <div key={i} className="upload-error-item">{err}</div>
            ))}
          </div>
        )}

        {staged.length > 0 && (
          <div className="staged-list" onClick={e => e.stopPropagation()}>
            {shown.map(f => (
              <div key={f.uid} className="staged-pill">
                <Icons.FileText size={12} />
                <span className="staged-name">{f.name}</span>
                <span className="staged-size">{f.size}</span>
                <button
                  className="remove-btn"
                  onClick={() => remove(f.uid)}
                  aria-label="Remove"
                >
                  <Icons.X size={11} />
                </button>
              </div>
            ))}
            {hiddenCount > 0 && !expanded && (
              <button className="staged-viewall" onClick={() => setExpanded(true)}>
                View all +{hiddenCount}
              </button>
            )}
            {expanded && staged.length > LIMIT && (
              <button className="staged-viewall" onClick={() => setExpanded(false)}>
                Show less
              </button>
            )}
          </div>
        )}

        {staged.length > 0 && (
          <div className="upload-cta-wrap" onClick={e => e.stopPropagation()}>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={uploading}
            >
              <Icons.UploadCloud size={14} />
              {uploading
                ? 'Uploading…'
                : `Upload ${staged.length} file${staged.length === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
