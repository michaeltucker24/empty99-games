import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static build served by Cloudflare (Workers static assets).
// Each game lives under its own path on empty99studios.com.
export default defineConfig({
  site: 'https://empty99studios.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'directory' },
  integrations: [react()],
});
