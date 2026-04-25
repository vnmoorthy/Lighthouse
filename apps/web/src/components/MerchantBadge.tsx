/**
 * Two-letter monogram badge derived deterministically from the display name.
 * Avoids fetching favicons (which would leak browsing patterns to merchants).
 */

const PALETTE = [
  'bg-emerald-500/20 text-emerald-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-violet-500/20 text-violet-300',
  'bg-rose-500/20 text-rose-300',
  'bg-amber-500/20 text-amber-300',
  'bg-indigo-500/20 text-indigo-300',
  'bg-pink-500/20 text-pink-300',
  'bg-teal-500/20 text-teal-300',
  'bg-orange-500/20 text-orange-300',
];

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

export default function MerchantBadge({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls = PALETTE[hash(name) % PALETTE.length];
  const dim = size === 'lg' ? 'w-10 h-10 text-sm' : size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-xs';
  return (
    <div className={`shrink-0 flex items-center justify-center rounded-md font-semibold ${dim} ${cls}`}>
      {initials(name)}
    </div>
  );
}
