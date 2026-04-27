/**
 * Drag-and-drop receipt photo upload. Sends the image base64 to
 * /api/ingest/photo, displays the result.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import { Camera, CheckCircle2, AlertCircle } from 'lucide-react';

interface IngestResult {
  email_id: number | null;
  receipt_id?: number;
  classification: string;
}

function fileToDataUrl(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, b64] = result.split(',');
      const m = /data:([^;]+);base64/.exec(header ?? '');
      const mediaType = m?.[1] ?? 'image/jpeg';
      resolve({ base64: b64 ?? '', mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload() {
  const qc = useQueryClient();
  const [drag, setDrag] = useState(false);
  const [last, setLast] = useState<IngestResult | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { base64, mediaType } = await fileToDataUrl(file);
      return apiPost<IngestResult>('/api/ingest/photo', {
        image_base64: base64,
        media_type: mediaType,
      });
    },
    onSuccess: (r) => {
      setLast(r);
      void qc.invalidateQueries({ queryKey: ['receipts'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });

  function onFile(f: File | null | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/')) return;
    upload.mutate(f);
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor="lh-photo-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
        className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          drag
            ? 'border-lh-coral bg-lh-coral/5'
            : 'border-lh-line2 hover:border-lh-coral/50 hover:bg-lh-line/30'
        }`}
      >
        <Camera size={20} className="mx-auto mb-2 text-lh-mute" strokeWidth={1.5} />
        <div className="text-sm text-lh-fore">
          {upload.isPending ? 'Reading the receipt…' : 'Drop a photo or click to upload'}
        </div>
        <div className="text-2xs text-lh-mute mt-1">
          JPG / PNG / WebP. Goes straight to the vision LLM; image isn't stored.
        </div>
      </label>
      <input
        id="lh-photo-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {last ? (
        <div className="lh-card p-3 flex items-center gap-2 text-2xs">
          {last.classification === 'photo_receipt' ? (
            <>
              <CheckCircle2 size={13} className="text-emerald-300" />
              <span className="text-lh-fore">
                Receipt extracted (id #{last.receipt_id}). Refresh Receipts to see it.
              </span>
            </>
          ) : last.classification === 'duplicate' ? (
            <>
              <AlertCircle size={13} className="text-amber-300" />
              <span className="text-lh-fore">Duplicate — already on file.</span>
            </>
          ) : (
            <>
              <AlertCircle size={13} className="text-rose-300" />
              <span className="text-lh-fore">
                Could not extract a receipt from this image.
              </span>
            </>
          )}
        </div>
      ) : null}
      {upload.isError ? (
        <div className="text-2xs text-rose-300">
          Failed: {(upload.error as Error).message}
        </div>
      ) : null}
    </div>
  );
}
