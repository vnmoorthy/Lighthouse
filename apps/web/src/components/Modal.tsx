import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-2xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-auto"
      onClick={onClose}
    >
      <div
        className={`mt-12 mb-12 w-full ${width} mx-4 lh-card`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-lh-line/60 px-5 py-3">
          <h3 className="text-base font-medium">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-lh-mute hover:text-lh-fore p-1 rounded"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
