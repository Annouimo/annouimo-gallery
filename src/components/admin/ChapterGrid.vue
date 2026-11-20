<script setup lang="ts">
import { computed } from 'vue'
import type { CategoryCopy } from '../../../shared/category-copy'

const props = withDefaults(
  defineProps<{
    total: number
    progress: number
    disabled?: boolean
    label?: string
    copy: CategoryCopy
  }>(),
  {
    disabled: false,
    label: '进度',
  },
)

const emit = defineEmits<{ select: [cell: number] }>()

const cells = computed(() =>
  props.total > 1 ? Array.from({ length: props.total }, (_, index) => index + 1) : [],
)

function select(cell: number): void {
  if (props.disabled) return
  emit('select', cell)
}
</script>

<template>
  <div class="grid" role="group" :aria-label="label">
    <button
      v-for="cell in cells"
      :key="cell"
      class="cell"
      :class="{ read: cell <= progress, latest: cell === progress, next: cell === progress + 1 }"
      type="button"
      :disabled="disabled"
      :aria-label="`${copy.chapterAriaPrefix} ${cell} ${copy.progressUnit}`"
      :aria-pressed="cell <= progress"
      @click="select(cell)"
    >
      {{ cell }}
    </button>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));
  gap: 0.35rem;
}

.cell {
  aspect-ratio: 1;
  padding: 0;
  font-size: 12px;
  color: var(--secondary);
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--background));
  border-radius: 4px;
  cursor: pointer;
}

.cell:hover:not(:disabled) {
  border-color: var(--primary);
}

.cell.read {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 14%, var(--background));
}

.cell.latest {
  color: var(--background);
  background: var(--primary);
  border-color: var(--primary);
}

.cell.next {
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 700;
}

.cell:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.cell:disabled {
  cursor: default;
  opacity: 0.6;
}
</style>
