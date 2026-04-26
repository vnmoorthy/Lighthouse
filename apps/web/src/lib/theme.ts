/**
 * Tiny theme manager. Three states: 'system' (default, follows OS),
 * 'dark', 'light'. Persisted in localStorage. Applied via a `data-theme`
 * attribute on <html>.
 */
import { useEffect, useState } from 'react';

export type Theme = 'system' | 'dark' | 'light';
const STORAGE = 'lh_theme';

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof localStorage === 'undefined') return 'system';
    return (localStorage.getItem(STORAGE) as Theme) ?? 'system';
  });
  useEffect(() => {
    apply(theme);
  }, [theme]);
  return [
    theme,
    (t) => {
      setThemeState(t);
      try {
        localStorage.setItem(STORAGE, t);
      } catch {
        /* localStorage may be blocked */
      }
    },
  ];
}

/** Apply persisted theme as soon as possible (called from main.tsx). */
export function bootstrapTheme(): void {
  try {
    const t = (localStorage.getItem(STORAGE) as Theme) ?? 'system';
    apply(t);
  } catch {
    /* ignore */
  }
}
