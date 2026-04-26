import type { ReactNode } from 'react';

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="px-8 pt-9 pb-6 border-b border-lh-line/40">
      <div className="flex items-start justify-between gap-6">
        <div>
          {eyebrow ? <div className="lh-eyebrow mb-2">{eyebrow}</div> : null}
          <h1 className="text-3xl font-semibold tracking-tightest text-lh-fore leading-none">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-lh-mute mt-3 max-w-2xl leading-relaxed">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0 mt-1">{actions}</div> : null}
      </div>
    </div>
  );
}
