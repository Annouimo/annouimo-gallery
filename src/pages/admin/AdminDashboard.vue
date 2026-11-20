<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { copyForType } from '../../../shared/categories'
import { todayLocalDay } from '../../../shared/dates'
import type { WorkWithState } from '../../../shared/types'
import ChapterGrid from '../../components/admin/ChapterGrid.vue'
import { deleteLog, getAdminWorkStates, postProgress, postStatus } from '../../lib/admin-api'
import { progressLabel, relativeDay } from '../../lib/format'
import { ApiError } from '../../lib/http'
import { showToast } from '../../lib/toast'

const state = ref<{ works: WorkWithState[] } | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const today = todayLocalDay()
const logDate = ref(today)
const lastAction = ref<{ logId: string; message: string } | null>(null)
const expanded = ref(new Set<string>())

function toggleGrid(id: string): void {
  if (!expanded.value.delete(id)) expanded.value.add(id)
}

async function undo(): Promise<void> {
  if (saving.value || !lastAction.value) return
  saving.value = true
  error.value = ''
  try {
    const result = await deleteLog(lastAction.value.logId)
    replaceWork(result.work)
    lastAction.value = null
    showToast('已撤销记录')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}

function recordAction(work: WorkWithState, logId: string, action: string, date: string): void {
  lastAction.value = { logId, message: `${work.title} · ${action} · ${date}` }
}

const reading = computed(() =>
  (state.value?.works ?? []).filter((work) => work.state.status === 'reading'),
)

const loggedOn = computed(() =>
  logDate.value !== '' && logDate.value !== today ? logDate.value : undefined,
)

function copyFor(work: WorkWithState) {
  return copyForType(work.type)
}

function workProgress(work: WorkWithState): string {
  return progressLabel(
    work.state.progress,
    work.total_progress,
    work.state.status,
    copyFor(work),
  )
}

function errorMessage(cause: unknown): string {
  if (!(cause instanceof ApiError)) {
    return cause instanceof Error ? cause.message : '操作失败'
  }
  if (cause.status === 401 || cause.status === 403) {
    return 'Access 登录已失效，请刷新页面。'
  }
  if (cause.status === 503) {
    return 'Cloudflare Access 尚未配置。'
  }
  return cause.message
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    state.value = await getAdminWorkStates()
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  document.title = '首页 · Annouimo 的陈列室'
  void load()
})

function replaceWork(work: WorkWithState): void {
  if (!state.value) return
  state.value = {
    works: state.value.works.map((item) => (item.id === work.id ? work : item)),
  }
}

async function setCell(work: WorkWithState, cell: number): Promise<void> {
  if (saving.value || cell === work.state.progress) return

  saving.value = true
  error.value = ''
  try {
    const result = await postProgress(work.id, {
      progress: cell,
      logged_on: loggedOn.value,
    })
    replaceWork(result.work)
    if (result.log) recordAction(work, result.log.id, `已记到第 ${cell}${copyFor(work).progressUnit}`, result.log.logged_on)
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}

async function markDone(work: WorkWithState): Promise<void> {
  if (saving.value) return

  saving.value = true
  error.value = ''
  try {
    const result = await postStatus(work.id, {
      status: 'done',
      logged_on: loggedOn.value,
    })
    replaceWork(result.work)
    if (result.log) recordAction(work, result.log.id, copyFor(work).status.done, result.log.logged_on)
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="dashboard">
    <header class="dash-header">
      <div>
        <h1>进行中</h1>
        <p class="muted">
          {{ reading.length }} 项进行中
        </p>
      </div>
      <label class="log-date">
        <span>记录日期</span>
        <input v-model="logDate" type="date" :max="today" :disabled="saving" />
      </label>
    </header>

    <p class="hint">默认按今天记录；改成过去的日期可以补录（只保留日期）。</p>

    <p v-if="loading" class="empty">正在加载…</p>
    <p v-else-if="error && !state" class="empty" role="alert">{{ error }}</p>

    <template v-else>
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>

      <div v-if="lastAction" class="card-actions">
        <span role="status">{{ lastAction.message }}</span>
        <button class="btn small" type="button" :disabled="saving" @click="undo">撤销</button>
      </div>

      <p v-if="reading.length === 0" class="empty">
        当前没有进行中的作品。
        <RouterLink to="/admin/library">去作品库看看</RouterLink>
      </p>

      <div v-else class="reading-list">
        <article v-for="work in reading" :key="work.id" class="reading-card">
          <header class="card-head">
            <div>
              <h2>
                <RouterLink :to="`/admin/works/${work.id}`">
                  {{ work.title }}
                </RouterLink>
              </h2>
              <p class="meta">
                <span v-if="work.creator">{{ work.creator }}</span>
                <span>{{ workProgress(work) }}</span>
                <span v-if="work.state.loggedOn" :title="work.state.loggedOn">
                  最近：{{ relativeDay(work.state.loggedOn) }}
                </span>
              </p>
            </div>
            <div class="card-actions">
              <button
                v-if="work.total_progress > 1 && work.state.progress < work.total_progress"
                class="btn primary small"
                type="button"
                :disabled="saving"
                @click="setCell(work, work.state.progress + 1)"
              >
                记到第 {{ work.state.progress + 1 }}{{ copyFor(work).progressUnit }}
              </button>
              <button
                v-if="work.total_progress > 1"
                class="btn small"
                type="button"
                :disabled="saving"
                @click="markDone(work)"
              >
                {{ copyFor(work).doneAction }}
              </button>
              <RouterLink class="open" :to="`/admin/works/${work.id}`">
                进度页 →
              </RouterLink>
            </div>
          </header>

          <button
            v-if="work.total_progress > 1"
            class="btn small"
            type="button"
            :aria-expanded="expanded.has(work.id)"
            @click="toggleGrid(work.id)"
          >
            {{ expanded.has(work.id) ? '收起进度格' : '跳到指定进度' }}
          </button>
          <ChapterGrid
            v-if="work.total_progress > 1 && expanded.has(work.id)"
            :total="work.total_progress"
            :progress="work.state.progress"
            :disabled="saving"
            :copy="copyFor(work)"
            :label="`${work.title} 的${copyFor(work).chapterLabel}`"
            @select="setCell(work, $event)"
          />
          <div v-if="work.total_progress <= 1" class="binary-row">
            <span class="hint">{{ copyFor(work).binaryHint }}</span>
            <button
              class="btn primary"
              type="button"
              :disabled="saving"
              @click="markDone(work)"
            >
              {{ copyFor(work).markDone }}
            </button>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  padding-top: 0.5rem;
}

.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.35rem;
}

.dash-header h1 {
  margin: 0 0 0.35rem;
  font-size: 40px;
  line-height: 1.2;
}

.muted {
  margin: 0;
  font-size: 14px;
  color: var(--secondary);
}

.log-date {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 13px;
  color: var(--secondary);
}

.log-date input {
  padding: 0.35rem 0.5rem;
  font-size: 13px;
  color: var(--primary);
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  outline: none;
}

.log-date input:focus {
  border-color: var(--primary);
}

.hint {
  margin: 0.5rem 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--secondary);
}

.reading-list {
  margin-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.reading-card {
  padding: 1.25rem 0 1.5rem;
  border-bottom: 1px solid var(--border);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.card-head h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.3;
}

.card-head h2 a:hover {
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.meta {
  margin: 0.35rem 0 0;
  font-size: 13px;
  color: var(--secondary);
}

.meta span + span::before {
  margin: 0 0.45rem;
  content: '·';
}

.card-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.75rem;
}

.open {
  font-size: 13px;
  color: var(--secondary);
}

.open:hover {
  color: var(--primary);
}

.binary-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn {
  padding: 0.5rem 0.85rem;
  font-size: 14px;
  color: var(--primary);
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  border-color: var(--primary);
}

.btn.primary {
  color: var(--background);
  background: var(--primary);
  border-color: var(--primary);
}

.btn.small {
  padding: 0.3rem 0.6rem;
  font-size: 12px;
}

.btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.error-banner {
  margin: 1rem 0 0;
  padding: 0.6rem 0.75rem;
  font-size: 13px;
  line-height: 1.6;
  color: var(--primary);
  border-left: 2px solid var(--primary);
}

.empty {
  padding: 2rem 0;
  color: var(--secondary);
}

.empty a {
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

@media (max-width: 768px) {
  .dash-header {
    flex-direction: column;
  }

  .dash-header h1 {
    font-size: 32px;
  }

  .log-date {
    width: 100%;
    justify-content: space-between;
  }

  .card-head {
    flex-direction: column;
  }

  .card-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
