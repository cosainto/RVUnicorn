/**
 * Shared media upload utility — direct browser-to-Cloudinary uploads.
 *
 * Every upload surface in the app should use this instead of posting
 * file bytes through our backend. Benefits:
 *   - No Railway request-size or timeout limits
 *   - Real per-file progress via XHR
 *   - One place to fix upload bugs
 *
 * Usage:
 *   const result = await uploadFile(file, {
 *     folder: 'rvunicorn/trip-photos/abc123',
 *     onProgress: (pct) => setProgress(pct),
 *   });
 *   // result.url, result.publicId, result.width, result.height
 *
 *   // Or batch with progress:
 *   const results = await uploadFiles(files, {
 *     folder: 'rvunicorn/albums',
 *     onFileProgress: (idx, pct) => ...,
 *     onFileComplete: (idx, result) => ...,
 *     onFileFailed: (idx, err) => ...,
 *   });
 */

const CLOUD_NAME = 'dy6eetmh7';
const UPLOAD_PRESET = 'rvunicorn_unsigned';

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
 */
export function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    if (opts.folder) formData.append('folder', opts.folder);

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
          reject(new Error('Invalid response from Cloudinary'));
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err?.error?.message) msg = err.error.message;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error — check your connection'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout = opts.timeoutMs ?? 300000; // 5 min default

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|m4v|webm)$/i.test(file.name);
    const resourceType = isVideo ? 'video' : 'image';
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);
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
