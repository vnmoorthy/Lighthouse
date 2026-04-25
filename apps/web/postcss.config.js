import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Explicit config path so PostCSS finds Tailwind regardless of where Vite
// was launched from (repo root vs apps/web).
const HERE = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [tailwindcss({ config: join(HERE, 'tailwind.config.js') }), autoprefixer()],
};
