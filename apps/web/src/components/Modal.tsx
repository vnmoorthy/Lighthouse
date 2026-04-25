import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  width = 'max-w-2xl',
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
}) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`mt-12 mb-12 w-full ${width} mx-4 lh-card-elev animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-lh-line/60 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold tracking-snug text-lh-fore">{title}</h3>
            {description ? (
              <p className="text-xs text-lh-mute mt-1">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lh-btn-icon"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer ? (
          <div className="border-t border-lh-line/60 px-6 py-4 flex justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
