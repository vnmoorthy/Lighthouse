/**
 * Two-letter monogram badge derived deterministically from the display name.
 * We avoid fetching favicons because that would leak browsing patterns
 * (and which Lighthouse user is interested in which merchant) to merchants.
 */

const PALETTE = [
  { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/20' },
  { bg: 'bg-cyan-500/15',    text: 'text-cyan-300',    ring: 'ring-cyan-500/20' },
  { bg: 'bg-violet-500/15',  text: 'text-violet-300',  ring: 'ring-violet-500/20' },
  { bg: 'bg-rose-500/15',    text: 'text-rose-300',    ring: 'ring-rose-500/20' },
  { bg: 'bg-amber-500/15',   text: 'text-amber-300',   ring: 'ring-amber-500/20' },
  { bg: 'bg-indigo-500/15',  text: 'text-indigo-300',  ring: 'ring-indigo-500/20' },
  { bg: 'bg-pink-500/15',    text: 'text-pink-300',    ring: 'ring-pink-500/20' },
  { bg: 'bg-teal-500/15',    text: 'text-teal-300',    ring: 'ring-teal-500/20' },
  { bg: 'bg-orange-500/15',  text: 'text-orange-300',  ring: 'ring-orange-500/20' },
  { bg: 'bg-sky-500/15',     text: 'text-sky-300',     ring: 'ring-sky-500/20' },
] as const;

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

const SIZE = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
} as const;

export default function MerchantBadge({
  name,
  size = 'md',
  ring = false,
}: {
  name: string;
  size?: keyof typeof SIZE;
  ring?: boolean;
}) {
  const palette = PALETTE[hash(name) % PALETTE.length]!;
  return (
    <div
      className={[
        'shrink-0 inline-flex items-center justify-center rounded-md font-semibold tracking-tight',
        SIZE[size],
        palette.bg,
        palette.text,
        ring ? `ring-1 ${palette.ring}` : '',
      ].join(' ')}
    >
      {initials(name)}
    </div>
  );
}
