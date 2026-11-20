<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CategoryCopy } from '../../shared/category-copy'
import type { PublicLog } from '../../shared/types'
import { describeLog } from '../lib/format'

const props = defineProps<{
  logs: PublicLog[]
  copy: CategoryCopy
  datesKnown: boolean
  total: number
}>()

const selectedIndex = ref<number>()
const showProgress = computed(() =>
  props.logs.length > 1 && (props.total > 1 || props.logs.some(log => log.total_snapshot > 1)),
)
const maximum = computed(() => Math.max(1, props.total, ...props.logs.map(log => Math.max(log.progress, log.total_snapshot))))
const ordered = computed(() => props.datesKnown
  ? [...props.logs].sort((a, b) => a.logged_on.localeCompare(b.logged_on))
  : props.logs)
const points = computed(() => {
  const days = ordered.value.map((log, index) => props.datesKnown ? Date.parse(log.logged_on) : index)
  const start = days[0] ?? 0
  const span = (days.at(-1) ?? start) - start
  return ordered.value.map((log, index) => ({
    log,
    x: span ? (days[index]! - start) / span * 100 : 50,
    y: showProgress.value ? (1 - log.progress / maximum.value) * 100 : 50,
  }))
})
const segments = computed(() => {
  const previous = new Map<number, (typeof points.value)[number]>()
  return points.value.flatMap(point => {
    const last = previous.get(point.log.round)
    previous.set(point.log.round, point)
    return last ? [{ last, point }] : []
  })
})
const currentIndex = computed(() => selectedIndex.value ?? points.value.length - 1)
const selected = computed(() => points.value[currentIndex.value]?.log)
</script>

<template>
  <figure class="progress-chart" aria-label="阅读或观看进度图">
    <figcaption v-if="!datesKnown" class="chart-meta">未记年月 · 按记录顺序</figcaption>
    <figcaption v-else-if="showProgress" class="chart-meta">进度（{{ copy.progressUnit }}）</figcaption>

    <div class="chart-body">
      <div v-if="showProgress" class="axis-y" aria-hidden="true">
        <span>{{ maximum }}</span>
        <span>0</span>
      </div>
      <div class="plot" :class="{ compact: !showProgress }">
        <div v-if="showProgress" class="plot-lines" aria-hidden="true">
          <template v-for="({ last, point }, index) in segments" :key="index">
            <span class="step horizontal" :style="{ left: last.x + '%', top: last.y + '%', width: point.x - last.x + '%' }" />
            <span class="step vertical" :style="{ left: point.x + '%', top: Math.min(last.y, point.y) + '%', height: Math.abs(point.y - last.y) + '%' }" />
          </template>
        </div>
        <button
          v-for="({ log, x, y }, index) in points"
          :key="index"
          type="button"
          class="point"
          :class="{ done: log.status === 'done', milestone: log.event !== 'progress' || (index > 0 && log.round !== points[index - 1]?.log.round) }"
          :style="{ left: x + '%', top: y + '%' }"
          :aria-label="`${datesKnown ? log.logged_on : '第 ' + (index + 1) + ' 条'} · ${describeLog(log, copy)}`"
          :aria-pressed="currentIndex === index"
          @click="selectedIndex = index"
        ><span aria-hidden="true" /></button>
      </div>
    </div>

    <div v-if="datesKnown && ordered.length > 1" class="axis-x" aria-hidden="true">
      <time>{{ ordered[0]?.logged_on }}</time>
      <time v-if="ordered.at(-1)?.logged_on !== ordered[0]?.logged_on">{{ ordered.at(-1)?.logged_on }}</time>
    </div>

    <div v-if="selected" class="selection">
      <button v-if="points.length > 1" type="button" aria-label="上一条记录" :disabled="currentIndex === 0" @click="selectedIndex = currentIndex - 1">←</button>
      <p aria-live="polite">
        <span class="chart-meta">{{ datesKnown ? selected.logged_on : '第 ' + (currentIndex + 1) + ' 条' }}</span>
        <span v-if="selected.round > 1" class="chart-meta"> · 第 {{ selected.round }} 次</span>
        <span> · {{ describeLog(selected, copy) }}</span>
      </p>
      <button v-if="points.length > 1" type="button" aria-label="下一条记录" :disabled="currentIndex === points.length - 1" @click="selectedIndex = currentIndex + 1">→</button>
    </div>
  </figure>
</template>

<style scoped>
.progress-chart { margin: 1rem 0 0; }
.chart-meta, .axis-x, .axis-y { color: var(--secondary); font-size: 13px; }
.chart-body { display: flex; gap: 0.65rem; margin: 0.75rem 0.8rem 0.5rem; }
.axis-y { display: flex; flex-direction: column; justify-content: space-between; font-variant-numeric: tabular-nums; }
.plot {
  position: relative;
  flex: 1;
  min-width: 0;
  height: clamp(7rem, 30vw, 11rem);
  border-block: 1px solid var(--tertiary);
}
.plot.compact { height: 2.5rem; border: 0; }
.step { position: absolute; background: var(--secondary); pointer-events: none; }
.horizontal { height: 1px; }
.vertical { width: 1px; }
.point {
  position: absolute;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.point span { width: 7px; height: 7px; border: 1px solid var(--primary); border-radius: 50%; background: var(--theme); }
.point.milestone span { width: 9px; height: 9px; border-radius: 2px; }
.point.done span { background: var(--primary); }
.point[aria-pressed='true'], .point:focus-visible { z-index: 1; }
.point[aria-pressed='true'] span { outline: 1px solid var(--primary); outline-offset: 3px; }
.axis-x { display: flex; justify-content: space-between; margin: 0 0.8rem 0 2.25rem; }
.selection { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.75rem; font-size: 14px; }
.selection p { margin: 0; }
.selection button { min-width: 2rem; min-height: 2rem; cursor: pointer; }
.selection button:disabled { opacity: 0.45; cursor: default; }
</style>
