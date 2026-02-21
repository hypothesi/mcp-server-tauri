import { defineConfig, type HeadConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

// Use /mcp-server-tauri/ for GitHub Pages, / for local dev
// eslint-disable-next-line no-process-env
const base = process.env.VITEPRESS_BASE || '/',
      // eslint-disable-next-line no-process-env
      isProd = process.env.NODE_ENV === 'production';

const siteUrl = 'https://hypothesi.github.io/mcp-server-tauri';

const analyticsHead: HeadConfig[] = isProd
   ? [ [ 'script', { defer: '', src: 'https://cloud.umami.is/script.js', 'data-website-id': '5a8a158d-72e4-4908-8598-b49127fc9494' } ] ]
   : [];

const siteDescription =
   'An MCP server that empowers AI assistants to build, test, and debug Tauri applications.';

// https://vitepress.dev/reference/site-config
export default defineConfig({
   title: 'MCP Server Tauri',
   description: siteDescription,
   base,
   cleanUrls: true,
   lastUpdated: true,
   sitemap: {
      hostname: siteUrl,
   },

   head: [
      [ 'link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` } ],
      [ 'meta', { name: 'theme-color', content: '#0ea5e9' } ],
      // Open Graph
      [ 'meta', { property: 'og:type', content: 'website' } ],
      [ 'meta', { property: 'og:locale', content: 'en' } ],
      [ 'meta', { property: 'og:site_name', content: 'MCP Server Tauri' } ],
      [ 'meta', { property: 'og:title', content: 'MCP Server Tauri - AI-Powered Tauri Development' } ],
      [ 'meta', { property: 'og:description', content: siteDescription } ],
      [ 'meta', { property: 'og:url', content: siteUrl } ],
      [ 'meta', { property: 'og:image', content: `${siteUrl}/logo.svg` } ],
      // Twitter Card
      [ 'meta', { name: 'twitter:card', content: 'summary' } ],
      [ 'meta', { name: 'twitter:title', content: 'MCP Server Tauri' } ],
      [ 'meta', { name: 'twitter:description', content: 'AI-powered tools for Tauri application development, testing, and debugging' } ],
      // SEO
      [
         'meta',
         {
            name: 'keywords',
            content: 'tauri, mcp, model context protocol, ai assistant, rust, ' +
               'desktop app, mobile app, ui automation, testing',
         },
      ],
      [ 'meta', { name: 'author', content: 'Matt Luedke' } ],
      [ 'meta', { name: 'robots', content: 'index, follow' } ],
      [ 'meta', { name: 'google-site-verification', content: 'VR-dhovCapAjsitFgJbSdpQedE7sYtSptP9Uf_eNBwY' } ],
      [ 'link', { rel: 'canonical', href: siteUrl } ],
      // Analytics (production only)
      ...analyticsHead,
   ],

   appearance: 'dark', // Enable theme toggle, default to dark

   vite: {
      plugins: [ llmstxt() ],
   },

   themeConfig: {
      logo: '/logo.svg',

      nav: [
         { text: 'Home', link: '/' },
         { text: 'Guide', link: '/guides/getting-started' },
         { text: 'API', link: '/api/' },
         { text: 'Changelog', link: '/changelog' },
      ],

      sidebar: {
         '/guides/': [
            {
               text: 'Guides',
               items: [
                  { text: 'Getting Started', link: '/guides/getting-started' },
                  { text: 'Using Prompts', link: '/guides/prompts' },
                  { text: 'Element Picker', link: '/guides/element-picker' },
               ],
            },
         ],
         '/api/': [
            {
               text: 'API Reference',
               items: [
                  { text: 'Overview', link: '/api/' },
                  { text: 'Prompts (Slash Commands)', link: '/api/prompts' },
                  { text: 'Mobile Development', link: '/api/mobile-development' },
                  { text: 'UI Automation', link: '/api/ui-automation' },
                  { text: 'WebView Interaction', link: '/api/webview-interaction' },
                  { text: 'IPC & Plugin', link: '/api/ipc-plugin' },
               ],
            },
         ],
      },

      socialLinks: [
         { icon: 'github', link: 'https://github.com/hypothesi/mcp-server-tauri' },
      ],

      footer: {
         message:
            'This is an unofficial community project. Not affiliated with, endorsed by, or ' +
            'associated with the Tauri project or CrabNebula Ltd.',
         copyright: 'MIT Licensed',
      },

      search: {
         provider: 'local',
      },

      editLink: {
         pattern: 'https://github.com/hypothesi/mcp-server-tauri/edit/main/docs/:path',
         text: 'Edit this page on GitHub',
      },
   },

   markdown: {
      theme: {
         light: 'material-theme-lighter',
         dark: 'material-theme-palenight',
      },
      lineNumbers: true,
   },
});
