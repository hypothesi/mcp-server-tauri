<template>
   <button
      type="button"
      class="copy-button"
      :class="{ copied }"
      :title="copied ? 'Copied!' : 'Copy to clipboard'"
      @click="copyToClipboard">
      <Check v-if="copied" :size="16" :stroke-width="2" />
      <Copy v-else :size="16" :stroke-width="2" />
      <span v-if="label">{{ copied ? 'Copied!' : label }}</span>
   </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Copy, Check } from 'lucide-vue-next';

interface Props {
   text: string;
   label?: string;
}

const props = defineProps<Props>();

const copied = ref(false);

async function copyToClipboard(): Promise<void> {
   try {
      await navigator.clipboard.writeText(props.text);
      copied.value = true;
      setTimeout(() => {
         copied.value = false;
      }, 2000);
   } catch(err) {
      console.error('Failed to copy:', err);
   }
}
</script>

<style scoped>
.copy-button {
   display: inline-flex;
   align-items: center;
   gap: 0.5rem;
   padding: 0.5rem 1rem;
   border: 1px solid var(--vp-c-divider);
   border-radius: 8px;
   background: var(--vp-c-bg-soft);
   color: var(--vp-c-text-1);
   font-size: 0.875rem;
   font-weight: 500;
   cursor: pointer;
   transition: all 0.2s ease;
}

.copy-button:hover {
   border-color: var(--vp-c-brand-1);
   background: var(--vp-c-bg-mute);
}

.copy-button.copied {
   border-color: var(--vp-c-green-1);
   color: var(--vp-c-green-1);
}
</style>
