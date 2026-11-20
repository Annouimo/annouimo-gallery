<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { copyForType } from '../../../shared/categories'
import type { WorkWithState } from '../../../shared/types'
import ChapterGrid from '../../components/admin/ChapterGrid.vue'
import { deleteLog, getAdminWorkStates, postProgress, postStatus } from '../../lib/admin-api'
import { progressLabel, relativeDay } from '../../lib/format'
import { ApiError } from '../../lib/http'

const state = ref<{ works: WorkWithState[] } | null>(null)
const loading = ref(true)
const pending = ref<{ workId: string; message: string } | null>(null)
const saving = computed(() => pending.value !== null)
const error = ref('')
const actions = ref<Record<string, { logId: string; message: string }>>({})
const actionError = ref<{ workId: string; message: string } | null>(null)

async function undo(workId: string): Promise<void> {
  const action = actions.value[workId]
  if (!action || saving.value) return
  pending.value = { workId, message: '正在撤销…' }
  actionError.value = null
  try {
    const result = await deleteLog(action.logId)
    replaceWork(result.work)
    delete actions.value[workId]
  } catch (cause) {
    actionError.value = { workId, message: errorMessage(cause) }
  } finally {
    pending.value = null
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

  const unit = copyFor(work).progressUnit
  pending.value = { workId: work.id, message: `正在记录第 ${cell} ${unit}…` }
  actionError.value = null
  try {
    const result = await postProgress(work.id, {
      progress: cell,
    })
    replaceWork(result.work)
    if (result.log) {
      const message = cell < work.state.progress
        ? `进度从第 ${work.state.progress} ${unit}回退到第 ${cell} ${unit}`
        : `已记到第 ${cell} ${unit}`
      recordAction(work, result.log.id, message, result.log.logged_on)
    }
  } catch (cause) {
    actionError.value = { workId: work.id, message: errorMessage(cause) }
  } finally {
    pending.value = null
  }
}

async function markDone(work: WorkWithState): Promise<void> {
  if (saving.value) return

  pending.value = { workId: work.id, message: `正在${copyFor(work).markDone}…` }
  actionError.value = null
  try {
    const result = await postStatus(work.id, {
      status: 'done',
    })
    replaceWork(result.work)
    if (result.log) recordAction(work, result.log.id, copyFor(work).status.done, result.log.logged_on)
  } catch (cause) {
    actionError.value = { workId: work.id, message: errorMessage(cause) }
  } finally {
    pending.value = null
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
                  {{ work.title }} <span class="work-arrow" aria-hidden="true">→</span>
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
            v-if="work.state.status === 'reading' && canMarkDone(work)"
            class="progress-actions"
          >
            <div class="card-actions">
              <span v-if="work.total_progress <= 1" class="hint">{{ copyFor(work).binaryHint }}</span>
              <button class="btn" type="button" :disabled="saving" @click="markDone(work)">
                {{ copyFor(work).markDone }}
              </button>
            </div>
          </div>
          <div
            v-if="pending?.workId === work.id || actionError?.workId === work.id || actions[work.id]"
            class="card-actions save-feedback"
          >
            <span v-if="actionError?.workId === work.id" role="alert">{{ actionError.message }}</span>
            <span v-else role="status">
              {{ pending?.workId === work.id ? pending.message : actions[work.id]?.message }}
            </span>
            <template v-if="actions[work.id] && pending?.workId !== work.id">
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
            </template>
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

.work-arrow {
  color: var(--secondary);
  font-size: 0.72em;
}

.save-feedback {
  position: sticky;
  z-index: 1;
  bottom: max(0.75rem, env(safe-area-inset-bottom));
  width: fit-content;
  max-width: 100%;
  margin-top: 0.75rem;
  padding: 0.4rem 0.55rem 0.4rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--entry);
  color: var(--primary);
  font-size: 13px;
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

  .card-head {
    flex-direction: column;
  }

}
</style>
