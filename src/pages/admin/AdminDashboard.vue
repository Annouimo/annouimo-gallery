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

const state = ref<{ works: WorkWithState[] } | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const today = todayLocalDay()
const logDate = ref(today)
const backdating = ref(false)
const actions = ref<Record<string, { logId: string; message: string }>>({})
const actionError = ref<{ workId: string; message: string } | null>(null)

function useToday(): void {
  logDate.value = today
  backdating.value = false
}

async function undo(workId: string): Promise<void> {
  const action = actions.value[workId]
  if (!action || saving.value) return
  saving.value = true
  actionError.value = null
  try {
    const result = await deleteLog(action.logId)
    replaceWork(result.work)
    delete actions.value[workId]
  } catch (cause) {
    actionError.value = { workId, message: errorMessage(cause) }
  } finally {
    saving.value = false
  }
}

function recordAction(work: WorkWithState, logId: string, action: string, date: string): void {
  actions.value[work.id] = { logId, message: `${action} · ${date}` }
}

const reading = computed(() =>
  (state.value?.works ?? []).filter((work) => work.state.status === 'reading'),
)
const visibleWorks = computed(() =>
  (state.value?.works ?? []).filter((work) => work.state.status === 'reading' || actions.value[work.id]),
)

const loggedOn = computed(() =>
  logDate.value !== '' && logDate.value !== today ? logDate.value : undefined,
)

function copyFor(work: WorkWithState) {
  return copyForType(work.type)
}

function canMarkDone(work: WorkWithState): boolean {
  return work.total_progress <= 1 || work.state.progress >= work.total_progress
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
  actionError.value = null
  try {
    const result = await postProgress(work.id, {
      progress: cell,
      logged_on: loggedOn.value,
    })
    replaceWork(result.work)
    if (result.log) recordAction(work, result.log.id, `已记到第 ${cell} ${copyFor(work).progressUnit}`, result.log.logged_on)
  } catch (cause) {
    actionError.value = { workId: work.id, message: errorMessage(cause) }
  } finally {
    saving.value = false
  }
}

async function markDone(work: WorkWithState): Promise<void> {
  if (saving.value) return

  saving.value = true
  actionError.value = null
  try {
    const result = await postStatus(work.id, {
      status: 'done',
      logged_on: loggedOn.value,
    })
    replaceWork(result.work)
    if (result.log) recordAction(work, result.log.id, copyFor(work).status.done, result.log.logged_on)
  } catch (cause) {
    actionError.value = { workId: work.id, message: errorMessage(cause) }
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
        <p v-if="state" class="muted">
          {{ reading.length }} 项进行中
        </p>
      </div>
      <div v-if="state" class="date-controls">
        <button v-if="!backdating" class="btn small" type="button" @click="backdating = true">
          补录
        </button>
        <template v-else>
          <label class="log-date">
            <span>补录日期</span>
            <input v-model="logDate" type="date" :max="today" :disabled="saving" />
          </label>
          <button class="btn small" type="button" :disabled="saving" @click="useToday">
            恢复今天
          </button>
        </template>
      </div>
    </header>

    <p v-if="loading" class="empty">正在加载…</p>
    <p v-else-if="error && !state" class="empty" role="alert">{{ error }}</p>

    <template v-else>
      <p v-if="visibleWorks.length === 0" class="empty">
        当前没有进行中的作品。
        <RouterLink to="/admin/library">去作品库看看</RouterLink>
      </p>

      <div v-else class="reading-list">
        <article v-for="work in visibleWorks" :key="work.id" class="reading-card">
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
          </header>

          <p v-if="loggedOn && work.state.status === 'reading'" class="hint backdate">
            补录于 <time :datetime="loggedOn">{{ loggedOn }}</time>
          </p>
          <ChapterGrid
            v-if="work.total_progress > 1"
            :total="work.total_progress"
            :progress="work.state.progress"
            :disabled="saving || work.state.status !== 'reading'"
            :copy="copyFor(work)"
            :label="`${work.title} 的${copyFor(work).chapterLabel}`"
            @select="setCell(work, $event)"
          />
          <div
            v-if="actions[work.id] || (work.state.status === 'reading' && canMarkDone(work))"
            class="progress-actions"
          >
            <div v-if="actions[work.id]" class="card-actions">
              <span role="status">{{ actions[work.id]?.message }}</span>
              <button class="btn small" type="button" :disabled="saving" @click="undo(work.id)">
                撤销
              </button>
              <button
                v-if="work.state.status === 'done'"
                class="btn small"
                type="button"
                :disabled="saving"
                @click="delete actions[work.id]"
              >
                关闭
              </button>
            </div>
            <div
              v-if="work.state.status === 'reading' && canMarkDone(work)"
              class="card-actions"
            >
              <span v-if="work.total_progress <= 1" class="hint">{{ copyFor(work).binaryHint }}</span>
              <button class="btn" type="button" :disabled="saving" @click="markDone(work)">
                {{ copyFor(work).markDone }}
              </button>
            </div>
          </div>
          <p v-if="actionError?.workId === work.id" class="error-banner" role="alert">
            {{ actionError.message }}
          </p>
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

.date-controls,
.progress-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
}

.progress-actions {
  margin-top: 0.75rem;
}

.card-actions {
  flex-wrap: wrap;
}

.backdate {
  margin: 0 0 0.5rem;
  color: var(--primary);
  font-weight: 600;
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
  }
}
</style>
