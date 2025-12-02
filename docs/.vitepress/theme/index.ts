import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';
import CopyButton from './components/CopyButton.vue';
import Feature from './components/Feature.vue';
import VersionBadge from './components/VersionBadge.vue';

export default {
   extends: DefaultTheme,
   Layout: () => {
      // Slots for custom layout components if needed
      return h(DefaultTheme.Layout, null, {
         'nav-bar-title-after': () => {
            return h(VersionBadge);
         },
      });
   },
   enhanceApp({ app }) {
      // Register custom components
      app.component('CopyButton', CopyButton);
      // eslint-disable-next-line vue/multi-word-component-names
      app.component('Feature', Feature);
      app.component('VersionBadge', VersionBadge);
   },
} satisfies Theme;
