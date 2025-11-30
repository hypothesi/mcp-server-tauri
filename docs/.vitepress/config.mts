import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

// Use /mcp-server-tauri/ for GitHub Pages, / for local dev
// eslint-disable-next-line no-process-env
const base = process.env.VITEPRESS_BASE || '/';

const siteUrl = 'https://hypothesi.github.io/mcp-server-tauri';

const siteDescription =
   'An MCP server that provides AI assistants with tools to interact with ' +
   'Tauri applications for development, testing, and debugging';

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
      [ 'meta', { name: 'author', content: 'Hypothesi' } ],
      [ 'meta', { name: 'robots', content: 'index, follow' } ],
      [ 'link', { rel: 'canonical', href: siteUrl } ],
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
               ],
            },
         ],
         '/api/': [
            {
               text: 'API Reference',
               items: [
                  { text: 'Overview', link: '/api/' },
                  { text: 'Prompts (Slash Commands)', link: '/api/prompts' },
                  { text: 'Project Management', link: '/api/project-management' },
                  { text: 'UI Automation', link: '/api/ui-automation' },
                  { text: 'WebView Interaction', link: '/api/webview-interaction' },
                  { text: 'IPC Plugin', link: '/api/ipc-plugin' },
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
