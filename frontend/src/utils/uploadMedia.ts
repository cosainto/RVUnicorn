/**
 * Shared media upload utility — direct browser-to-Cloudinary uploads.
 *
 * Flow: frontend gets a signature from our backend, then uploads
 * directly to Cloudinary with that signature. No file bytes pass
 * through Railway.
 *
 * Usage:
 *   const result = await uploadFile(file, {
 *     folder: 'rvunicorn/trip-photos/abc123',
 *     onProgress: (pct) => setProgress(pct),
 *   });
 *   // result.url, result.publicId, result.width, result.height
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

export interface UploadOptions {
  folder?: string;
  onProgress?: (pct: number) => void;
  timeoutMs?: number;
}

export interface BatchUploadOptions {
  folder?: string;
  concurrency?: number;
  onFileProgress?: (index: number, pct: number) => void;
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
 * Step 1: Get signature from backend (GET /api/upload/sign?folder=...)
 * Step 2: POST file + signed params to Cloudinary
 */
export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const folder = opts.folder || 'rvunicorn/uploads';

  // Step 1: Get signature from our backend
  let signData: { signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string };
  try {
    const { data } = await api.get('/upload/sign', { params: { folder } });
    signData = data;
  } catch (err: any) {
    const msg = err?.response?.data?.error || err?.message || 'Failed to get upload signature';
    throw new Error(`[sign] ${msg}`);
  }

  // Step 2: Upload directly to Cloudinary with the signature
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signData.apiKey);
    formData.append('timestamp', String(signData.timestamp));
    formData.append('signature', signData.signature);
    formData.append('folder', signData.folder);
    // Only these params are signed — do NOT add upload_preset, tags, or anything else

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
    xhr.timeout = opts.timeoutMs ?? 300000; // 5 min default

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|m4v|webm)$/i.test(file.name);
    const resourceType = isVideo ? 'video' : 'image';
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`);
    xhr.send(formData);
  });
}

/**
 * Upload multiple files with per-file progress and error isolation.
 * Files are uploaded sequentially to avoid saturating mobile connections.
 */
export async function uploadFiles(files: File[], opts: BatchUploadOptions = {}): Promise<BatchUploadResult> {
  const results: (UploadResult | null)[] = new Array(files.length).fill(null);
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    try {
      const result = await uploadFile(files[i], {
        folder: opts.folder,
        onProgress: (pct) => opts.onFileProgress?.(i, pct),
        timeoutMs: opts.timeoutMs,
      });
      results[i] = result;
      succeeded++;
      opts.onFileComplete?.(i, result);
    } catch (err: any) {
      failed++;
      opts.onFileFailed?.(i, err);
    }
  }

  return { results, succeeded, failed };
}

/**
 * Upload a single file and return just the URL. Convenience wrapper
 * for simple cases where you don't need progress or metadata.
 */
export async function uploadAndGetUrl(file: File, folder?: string): Promise<string> {
  const result = await uploadFile(file, { folder });
  return result.url;
}
