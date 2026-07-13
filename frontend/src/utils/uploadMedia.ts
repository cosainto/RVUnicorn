/**
 * Shared media upload utility — direct browser-to-Cloudinary uploads.
 *
 * Flow: frontend gets a signature from our backend, then uploads
 * directly to Cloudinary with that signature. No file bytes pass
 * through Railway.
 */

import api from '../services/api';

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  resourceType: 'image' | 'video';
  bytes?: number;
}

export type FileStatus = 'queued' | 'uploading' | 'saving' | 'done' | 'failed';

export interface UploadOptions {
  folder?: string;
  onProgress?: (pct: number) => void;
  timeoutMs?: number;
}

export interface BatchUploadOptions {
  folder?: string;
  concurrency?: number;
  onFileStatus?: (index: number, status: FileStatus, pct: number) => void;
  onFileComplete?: (index: number, result: UploadResult) => void;
  onFileFailed?: (index: number, error: Error) => void;
  timeoutMs?: number;
}

export interface BatchUploadResult {
  results: (UploadResult | null)[];
  succeeded: number;
  failed: number;
}

/**
 * Upload a single file directly to Cloudinary with progress tracking.
 * Step 1: Get signature from backend
 * Step 2: POST file + signed params to Cloudinary
 */
export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const folder = opts.folder || 'rvunicorn/uploads';

  // Step 1: Get signature
  let signData: { signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string };
  try {
    const { data } = await api.get('/upload/sign', { params: { folder } });
    signData = data;
  } catch (err: any) {
    const msg = err?.response?.data?.error || err?.message || 'Failed to get upload signature';
    throw new Error(`[sign] ${msg}`);
  }

  // Step 2: Upload to Cloudinary with XHR for progress
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signData.apiKey);
    formData.append('timestamp', String(signData.timestamp));
    formData.append('signature', signData.signature);
    formData.append('folder', signData.folder);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    });

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.secure_url,
            publicId: data.public_id,
            width: data.width,
            height: data.height,
            duration: data.duration ? Math.round(data.duration) : undefined,
            format: data.format,
            resourceType: data.resource_type === 'video' ? 'video' : 'image',
            bytes: data.bytes,
          });
        } catch {
          reject(new Error('[cloudinary] Invalid response'));
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err?.error?.message) msg = err.error.message;
        } catch {}
        reject(new Error(`[cloudinary] ${msg}`));
      }
    };

    xhr.onerror = () => reject(new Error('[cloudinary] Network error — check your connection'));
    xhr.ontimeout = () => reject(new Error('[cloudinary] Upload timed out'));
    xhr.timeout = opts.timeoutMs ?? 300000;

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|m4v|webm)$/i.test(file.name);
    const resourceType = isVideo ? 'video' : 'image';
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`);
    xhr.send(formData);
  });
}

/**
 * Upload multiple files with a concurrency pool.
 * At most `concurrency` files upload simultaneously (default 3).
 * Per-file error isolation: one failure never stops the pool.
 */
export async function uploadFiles(files: File[], opts: BatchUploadOptions = {}): Promise<BatchUploadResult> {
  const concurrency = opts.concurrency ?? 3;
  const results: (UploadResult | null)[] = new Array(files.length).fill(null);
  let succeeded = 0;
  let failed = 0;

  // Index queue — workers pull from this
  let nextIndex = 0;

  // Mark all as queued initially
  for (let i = 0; i < files.length; i++) {
    opts.onFileStatus?.(i, 'queued', 0);
  }

  const worker = async () => {
    while (nextIndex < files.length) {
      const i = nextIndex++;
      opts.onFileStatus?.(i, 'uploading', 0);
      try {
        const result = await uploadFile(files[i], {
          folder: opts.folder,
          onProgress: (pct) => opts.onFileStatus?.(i, 'uploading', pct),
          timeoutMs: opts.timeoutMs,
        });
        opts.onFileStatus?.(i, 'saving', 100);
        results[i] = result;
        succeeded++;
        opts.onFileStatus?.(i, 'done', 100);
        opts.onFileComplete?.(i, result);
      } catch (err: any) {
        failed++;
        opts.onFileStatus?.(i, 'failed', 0);
        opts.onFileFailed?.(i, err);
      }
    }
  };

  // Spawn pool workers
  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker());
  await Promise.all(workers);

  return { results, succeeded, failed };
}

/**
 * Upload a single file and return just the URL.
 */
export async function uploadAndGetUrl(file: File, folder?: string): Promise<string> {
  const result = await uploadFile(file, { folder });
  return result.url;
}
