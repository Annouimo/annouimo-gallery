<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { categoryForType, copyForType } from '../../shared/categories'
import { UNKNOWN_DATE_LABEL } from '../../shared/constants'
import type { PublicWorkDetail } from '../../shared/types'
import { ApiError, getPublicWork } from '../lib/api'
import ReadingProgressChart from '../components/ReadingProgressChart.vue'
import { progressSummary, statusLabel } from '../lib/format'

const route = useRoute()
const detail = ref<PublicWorkDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)
const error = ref('')

const work = computed(() => detail.value?.work ?? null)
const logs = computed(() => detail.value?.logs ?? [])
const copy = computed(() => copyForType(work.value?.type ?? ''))
const typeLabel = computed(() => {
  const type = work.value?.type
  return type ? (categoryForType(type)?.label ?? type) : ''
})
const backCategory = computed(() => {
  const type = work.value?.type
  return type ? categoryForType(type) : undefined
})

async function load(id: string): Promise<void> {
  loading.value = true
  error.value = ''
  notFound.value = false
  detail.value = null

  try {
    detail.value = await getPublicWork(id)
    document.title = `${detail.value.work.title} · 书与影`
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) {
      notFound.value = true
      document.title = '作品不存在 · 书与影'
    } else {
      error.value = cause instanceof Error ? cause.message : '加载失败'
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  (id) => {
    if (typeof id === 'string') {
      void load(id)
    } else {
      notFound.value = true
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="work-page">
    <p v-if="loading" class="empty">正在加载…</p>

    <p v-else-if="notFound" class="empty">
      没有找到这个作品。
      <RouterLink to="/">返回首页</RouterLink>
    </p>

    <p v-else-if="error" class="empty" role="alert">{{ error }}</p>

    <article v-else-if="work" class="work">
      <p class="back">
        <RouterLink :to="backCategory?.path ?? '/'">
          {{ backCategory ? `← 返回${backCategory.label}` : '← 返回首页' }}
        </RouterLink>
      </p>

      <header class="work-header ann-page-heading">
        <h1 class="work-title">{{ work.title }}</h1>
        <p class="meta ann-heading-details">
          <span v-if="work.creator">{{ work.creator }}</span>
          <span v-if="work.release_year">{{ work.release_year }}</span>
          <span>{{ typeLabel }}</span>
          <span>{{ statusLabel(work.status, copy) }}</span>
          <span v-if="work.finished_on && work.date_precision === 'day'">
            {{ copy.finishedOn }} {{ work.finished_on }}
          </span>
          <span v-else-if="work.date_precision !== 'day'">{{ UNKNOWN_DATE_LABEL }}</span>
        </p>
        <p class="progress">{{ progressSummary(work, copy) }}</p>
      </header>

      <p v-if="work.short_review" class="review">{{ work.short_review }}</p>

      <p v-if="work.long_review_url" class="long-review">
        <a :href="work.long_review_url" target="_blank" rel="noopener noreferrer">长评 →</a>
      </p>

      <section v-if="logs.length" :key="work.id" class="history" aria-labelledby="history-title">
        <h2 id="history-title" class="history-title">
          {{ copy.progressUnit === '话' ? '观看记录' : '阅读记录' }}
          <span class="history-count">· {{ logs.length }} 条</span>
        </h2>
        <ReadingProgressChart
          :logs="logs"
          :copy="copy"
          :dates-known="work.date_precision === 'day'"
          :total="work.total_progress"
        />
      </section>
    </article>
  </div>
</template>

<style scoped>
.work-page {
  padding-top: 1.5rem;
}

.back {
  margin: 0 0 1.5rem;
  font-size: 14px;
  color: var(--secondary);
}

.back a:hover {
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.work-header {
  margin-bottom: 2rem;
}

.work-title {
  margin: 0 0 0.75rem;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.2;
}

.meta {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--secondary);
}

.meta span + span::before {
  margin: 0 0.45rem;
  color: var(--secondary);
  content: '·';
}

.progress {
  margin: 0.5rem 0 0;
  font-size: 14px;
  color: var(--secondary);
}

.review {
  margin: 2rem 0 0;
  font-size: 18px;
  line-height: 1.8;
  color: var(--content);
  white-space: pre-line;
}

.long-review {
  margin: 1.25rem 0 0;
  font-size: 16px;
}

.long-review a {
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.history {
  margin-top: 3rem;
}

.history-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.history-count {
  color: var(--secondary);
  font-size: 13px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.empty {
  padding: 2rem 0;
  color: var(--secondary);
}

.empty a {
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

</style>
