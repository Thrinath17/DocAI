export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type Accuracy = 'up' | 'down' | null;
export type FileType = 'PDF' | 'JPG' | 'PNG';

export interface Job {
  id: string;
  filename: string;
  fileSize: string;
  fileType: FileType;
  status: JobStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
  accuracy: Accuracy;
  result?: Record<string, unknown>;
}

export interface StagedFile {
  uid: number;
  file: File;
  name: string;
  size: string;
}

export interface UploadResponse {
  job_id: string;
  status: JobStatus;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  error?: string;
  created_at: string;
  updated_at: string;
}
