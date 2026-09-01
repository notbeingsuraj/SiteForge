// Webloom generated-site Astro configuration.
// The site is built as a fully static site (SSG) — no server runtime needed for
// the generated pages themselves. This keeps generated sites fast, deterministic,
// and trivially servable from the static `dist/` output on a local port.

import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: {
    assets: '_assets',
  },
  // Generate from the `src/` tree; the site config lives in src/data.
  vite: {
    build: {
      target: 'es2020',
    },
  },
});
