<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Database, Cpu, Lock, FileText, ShieldCheck, Zap, Loader2, CheckCircle, XCircle, FolderOpen, Edit3, Copy, Check } from 'lucide-vue-next'
import { type AIMode, useJournalStore } from '@/stores/journal'
import { getVariant } from '@/services/abTest'

const journalStore = useJournalStore()

// ---- 数据存储路径 ----
const dataPath = ref('')
const defaultPath = ref('')
const editingPath = ref(false)
const newPathInput = ref('')
const pathCopied = ref(false)
const pathMessage = ref('')
const pathMessageType = ref<'success' | 'error'>('success')

async function loadStoragePath() {
  if (typeof window !== 'undefined' && window.api?.storage) {
    try {
      const result = await window.api.storage.getPath()
      if (result.success) {
        dataPath.value = result.currentPath || ''
        defaultPath.value = result.defaultPath || ''
      }
    } catch {}
  }
}

function startEditPath() {
  newPathInput.value = dataPath.value
  editingPath.value = true
}

async function saveNewPath() {
  if (!newPathInput.value.trim()) return
  if (typeof window !== 'undefined' && window.api?.storage) {
    try {
      const result = await window.api.storage.setPath(newPathInput.value.trim())
      if (result.success) {
        dataPath.value = result.newPath || newPathInput.value.trim()
        pathMessage.value = '数据路径已更新。重启应用后生效。'
        pathMessageType.value = 'success'
        editingPath.value = false
      } else {
        pathMessage.value = result.error || '设置失败'
        pathMessageType.value = 'error'
      }
    } catch (e: any) {
      pathMessage.value = e.message || '设置失败'
      pathMessageType.value = 'error'
    }
  }
}

async function pickFolder() {
  if (typeof window !== 'undefined' && window.api?.storage) {
    try {
      const result = await window.api.storage.pickFolder()
      if (result.success && result.path) {
        newPathInput.value = result.path
      }
    } catch {}
  }
}

function cancelEditPath() {
  editingPath.value = false
  pathMessage.value = ''
}

async function copyPath() {
  try {
    await navigator.clipboard.writeText(dataPath.value)
    pathCopied.value = true
    setTimeout(() => { pathCopied.value = false }, 2000)
  } catch {}
}

onMounted(() => {
  loadStoragePath()
})

const aiMode = computed<AIMode>(() => journalStore.prefs.aiMode)
const aiKey = computed<string>(() => journalStore.prefs.aiKey)
const aiBaseUrl = computed<string>(() => journalStore.prefs.aiBaseUrl || '')
const aiModel = computed<string>(() => journalStore.prefs.aiModel || '')
const e2ee = computed<boolean>(() => journalStore.prefs.e2eeEnabled)
const auditLog = computed(() => journalStore.auditLog as any[])

// 云模型端点检测
const cloudEndpointConfigured = computed(() => {
  const endpoint = import.meta.env.VITE_MINDFLOW_LLM_ENDPOINT as string | undefined
  return !!endpoint && endpoint.trim() !== ''
})

// exp1 隐私徽标
const exp1Variant = ref<'control' | 'treatment' | null>(null)

onMounted(async () => {
  exp1Variant.value = await getVariant('exp1_privacy')
})

function setMode(m: AIMode) {
  journalStore.setAIMode(m)
}
function onKey(e: Event) {
  journalStore.setAIKey((e.target as HTMLInputElement).value)
}
function onBaseUrl(e: Event) {
  journalStore.setAIPref({ aiBaseUrl: (e.target as HTMLInputElement).value })
}
function onModel(e: Event) {
  journalStore.setAIPref({ aiModel: (e.target as HTMLInputElement).value })
}
function toggleE2ee() {
  journalStore.setE2EE(!e2ee.value)
}

// ---- AI 连接测试 ----
const testStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const testMessage = ref('')
const testDuration = ref(0)

/**
 * 测试用请求：Electron 环境优先走主进程转发（window.api.ai.fetch，
 * 规避渲染进程 CORS/代理限制），非 Electron 回退浏览器 fetch。
 * 返回标准 Response，15s 超时语义不变。
 */
async function fetchAiRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  controller: AbortController
): Promise<Response> {
  const apiAiFetch = typeof window !== 'undefined' ? window.api?.ai?.fetch : undefined
  if (apiAiFetch) {
    const r = await apiAiFetch({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body,
      timeoutMs: 15000,
    })
    return new Response(r.bodyText ?? '', { status: r.status, headers: r.headers })
  }
  return fetch(url, { ...init, signal: controller.signal })
}

async function testConnection() {
  testStatus.value = 'testing'
  testMessage.value = ''
  testDuration.value = 0
  const startTime = Date.now()

  const baseUrl = aiBaseUrl.value || 'https://api.openai.com/v1'
  const isOllama = baseUrl.includes('localhost:11434') || baseUrl.includes('127.0.0.1:11434')
  const model = aiModel.value || (isOllama ? 'llama3.1' : 'gpt-4o-mini')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    // 第一步：尝试 models 端点探测（不消耗 token）
    if (isOllama) {
      const modelsUrl = baseUrl.replace(/\/+$/, '') + '/api/tags'
      const res = await fetchAiRequest(modelsUrl, {}, controller)
      if (res.ok) {
        const data = await res.json()
        const models = data?.models?.map((m: any) => m.name) || []
        testDuration.value = Date.now() - startTime
        testStatus.value = 'success'
        testMessage.value = `连接成功！Ollama 可用模型：${models.slice(0, 5).join(', ')}${models.length > 5 ? '…' : ''}`
        return
      }
    } else {
      const modelsUrl = baseUrl.replace(/\/+$/, '') + '/models'
      const headers: Record<string, string> = {}
      if (aiKey.value) headers['Authorization'] = `Bearer ${aiKey.value}`
      const res = await fetchAiRequest(modelsUrl, { headers }, controller)
      if (res.ok) {
        const data = await res.json()
        const models = data?.data?.map((m: any) => m.id) || []
        testDuration.value = Date.now() - startTime
        testStatus.value = 'success'
        testMessage.value = `连接成功！可用模型：${models.slice(0, 5).join(', ')}${models.length > 5 ? '…' : ''}`
        return
      }
      // models 端点返回非 200，继续尝试 chat
      if (res.status === 401) {
        testDuration.value = Date.now() - startTime
        testStatus.value = 'error'
        testMessage.value = '认证失败：API Key 无效或已过期。'
        return
      }
    }

    // 第二步：models 端点失败，尝试极小的 chat 请求
    let chatUrl: string
    let chatBody: any
    let chatHeaders: Record<string, string> = { 'Content-Type': 'application/json' }

    if (isOllama) {
      chatUrl = baseUrl.replace(/\/+$/, '') + '/api/chat'
      chatBody = { model, messages: [{ role: 'user', content: 'hi' }], stream: false }
    } else {
      chatUrl = baseUrl.replace(/\/+$/, '') + '/chat/completions'
      if (aiKey.value) chatHeaders['Authorization'] = `Bearer ${aiKey.value}`
      chatBody = { model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }
    }

    const chatRes = await fetchAiRequest(
      chatUrl,
      { method: 'POST', headers: chatHeaders, body: JSON.stringify(chatBody) },
      controller
    )

    testDuration.value = Date.now() - startTime

    if (chatRes.ok) {
      testStatus.value = 'success'
      testMessage.value = `连接成功！模型 ${model} 响应正常。`
    } else {
      const errText = await chatRes.text().catch(() => '')
      testStatus.value = 'error'
      if (chatRes.status === 401) {
        testMessage.value = '认证失败：API Key 无效。'
      } else if (chatRes.status === 404) {
        testMessage.value = `模型 ${model} 不存在，请检查模型名称。`
      } else {
        testMessage.value = `连接失败：HTTP ${chatRes.status}。${errText.slice(0, 100)}`
      }
    }
  } catch (e: any) {
    testDuration.value = Date.now() - startTime
    testStatus.value = 'error'
    if (e.name === 'AbortError') {
      testMessage.value = '连接超时（15秒），请检查网络或 Base URL。'
    } else {
      testMessage.value = `连接失败：${e.message || '网络错误'}`
    }
  } finally {
    clearTimeout(timer)
  }
}

const actionLabel: Record<string, string> = {
  ai_review_generated: '生成复盘',
  ai_review_adopted: '采纳复盘',
  ai_review_dismissed: '丢弃复盘',
  ai_mode_change: '切换 AI 模式',
  e2ee_toggle: '加密开关',
  ai_client_fallback: 'AI 回退本地',
}
</script>

<template>
  <section class="max-w-3xl mx-auto px-6 py-8 animate-fade-up">
    <header class="mb-6">
      <p class="text-ink-2 text-sm">数据主权</p>
      <h1 class="text-ink">隐私与数据</h1>
      <p class="text-ink-2 text-sm mt-1">本地优先、隐私开源，是 MindFlow 的立身之本。</p>
    </header>

    <!-- 数据主权 -->
    <div class="card p-5 mb-4">
      <div class="flex items-center gap-2 mb-2">
        <Database :size="18" class="text-accent" />
        <h3 class="text-ink">数据全部在本机</h3>
        <span class="chip ml-auto">本机存储</span>
      </div>
      <p class="text-sm text-ink-2 leading-relaxed">
        所有记录、复盘与知识库都存放在你设备的 IndexedDB 中，离线可用、不依赖云端。
        我们不会在未经你允许的情况下把数据上传到任何服务器。
      </p>
    </div>

    <!-- 数据存储路径 -->
    <div class="card p-5 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <FolderOpen :size="18" class="text-accent" />
        <h3 class="text-ink">数据存储位置</h3>
      </div>
      <p class="text-sm text-ink-2 mb-3">
        以下是你的数据实际存放路径。所有记录、设置、待办均保存在此目录下。
      </p>

      <!-- 当前路径 -->
      <div v-if="dataPath && !editingPath" class="flex items-center gap-2 p-3 rounded-xl bg-surface-2 border border-line/50">
        <code class="flex-1 text-xs text-ink break-all">{{ dataPath }}</code>
        <button class="btn btn-ghost !p-1.5 shrink-0" @click="copyPath" title="复制路径">
          <component :is="pathCopied ? Check : Copy" :size="14" :class="pathCopied ? 'text-accent' : 'text-ink-2'" />
        </button>
        <button class="btn btn-ghost !p-1.5 shrink-0" @click="startEditPath" title="修改路径">
          <Edit3 :size="14" class="text-ink-2" />
        </button>
      </div>

      <!-- Electron 环境下的路径编辑 -->
      <div v-if="typeof window !== 'undefined' && window.api?.storage && !dataPath && !editingPath" class="text-sm text-ink-2 py-2">
        正在加载存储路径…
      </div>

      <!-- Web 环境提示 -->
      <div v-if="typeof window === 'undefined' || !window.api?.storage" class="p-3 rounded-xl bg-surface-2 border border-line/50">
        <p class="text-sm text-ink-2">
          数据存储在浏览器的 IndexedDB 中，路径由浏览器管理。
        </p>
      </div>

      <!-- 编辑路径 -->
      <div v-if="editingPath" class="space-y-3">
        <div class="flex gap-2">
          <input
            class="input flex-1"
            v-model="newPathInput"
            placeholder="输入新的数据存储路径"
          />
          <button class="btn btn-ghost shrink-0" @click="pickFolder" title="选择文件夹">
            <FolderOpen :size="16" />
          </button>
        </div>
        <div class="flex gap-2 justify-end">
          <button class="btn btn-ghost text-sm" @click="cancelEditPath">取消</button>
          <button class="btn btn-primary text-sm" @click="saveNewPath" :disabled="!newPathInput.trim() || newPathInput.trim() === dataPath">
            保存
          </button>
        </div>
        <p class="text-[0.72rem] text-ink-2">修改路径后需要重启应用才能生效。已有数据不会自动迁移。</p>
      </div>

      <!-- 操作反馈 -->
      <div v-if="pathMessage" class="mt-2 text-xs" :class="pathMessageType === 'success' ? 'text-accent' : 'text-ember'">
        {{ pathMessage }}
      </div>
    </div>

    <!-- AI 模式 -->
    <div class="card p-5 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <Cpu :size="18" class="text-accent" />
        <h3 class="text-ink">AI 模式</h3>
        <!-- exp1 隐私徽标 -->
        <span v-if="exp1Variant === 'treatment'" class="chip-soft text-[0.72rem] px-2 py-0.5 rounded-full ml-auto">
          本地 · 不训练 · 可关
        </span>
      </div>
      <label class="field-label">复盘引擎</label>
      <select class="input" :value="aiMode" @change="setMode(($event.target as HTMLSelectElement).value as AIMode)">
        <option value="local">本地镜像（离线、免 Key、纯整理）</option>
        <option value="byok">自带 Key（接入你自己的模型）</option>
        <option value="cloud">云端（MindFlow 订阅模型）</option>
      </select>

      <!-- BYOK 模式配置 -->
      <div v-if="aiMode === 'byok'" class="mt-3 card-soft p-4 space-y-3">
        <div>
          <label class="field-label">API Key</label>
          <input class="input" type="password" placeholder="sk-..." :value="aiKey" @input="onKey" />
          <p class="text-[0.75rem] text-ink-2 mt-1">Ollama 本地模式无需填写 Key。</p>
        </div>
        <div>
          <label class="field-label">Base URL（可选）</label>
          <input
            class="input"
            type="text"
            placeholder="https://api.openai.com/v1 或 http://localhost:11434"
            :value="aiBaseUrl"
            @input="onBaseUrl"
          />
          <p class="text-[0.75rem] text-ink-2 mt-1">
            留空默认 OpenAI 官方端点。填 http://localhost:11434 使用 Ollama 本地模型。
          </p>
        </div>
        <div>
          <label class="field-label">模型名称（可选）</label>
          <input
            class="input"
            type="text"
            placeholder="gpt-4o-mini 或 llama3.1"
            :value="aiModel"
            @input="onModel"
          />
          <p class="text-[0.75rem] text-ink-2 mt-1">
            留空默认：OpenAI 用 gpt-4o-mini，Ollama 用 llama3.1。
          </p>
        </div>

        <!-- 连接测试按钮 -->
        <div class="pt-2 border-t border-line/50">
          <button
            class="btn btn-primary w-full"
            :disabled="testStatus === 'testing'"
            @click="testConnection"
          >
            <Loader2 v-if="testStatus === 'testing'" :size="16" class="animate-spin" />
            <Zap v-else :size="16" />
            {{ testStatus === 'testing' ? '测试中…' : '测试连接' }}
          </button>

          <!-- 测试结果 -->
          <div v-if="testStatus === 'success'" class="mt-3 flex items-start gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle :size="16" class="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
            <div>
              <p class="text-sm font-medium text-green-700 dark:text-green-300">连接成功</p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-0.5">{{ testMessage }}</p>
              <p class="text-xs text-green-500 dark:text-green-500 mt-0.5">耗时 {{ testDuration }}ms</p>
            </div>
          </div>

          <div v-if="testStatus === 'error'" class="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <XCircle :size="16" class="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div>
              <p class="text-sm font-medium text-red-700 dark:text-red-300">连接失败</p>
              <p class="text-xs text-red-600 dark:text-red-400 mt-0.5">{{ testMessage }}</p>
              <p class="text-xs text-red-500 dark:text-red-500 mt-0.5">耗时 {{ testDuration }}ms</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Cloud 模式配置 -->
      <div v-if="aiMode === 'cloud'" class="mt-3 card-soft p-4">
        <div class="flex items-center gap-2 mb-2">
          <ShieldCheck :size="16" :class="cloudEndpointConfigured ? 'text-accent' : 'text-ember'" />
          <span class="text-sm font-medium" :class="cloudEndpointConfigured ? 'text-ink' : 'text-ember'">
            {{ cloudEndpointConfigured ? '云模型已配置' : '云模型尚未配置' }}
          </span>
        </div>
        <p v-if="!cloudEndpointConfigured" class="text-[0.82rem] text-ember leading-relaxed">
          云模型尚未在本地配置，可改用本地镜像或自带 Key。如需开通云模型订阅，请关注 MindFlow 后续更新。
        </p>
        <p v-else class="text-[0.82rem] text-ink-2 leading-relaxed">
          云模型已就绪。所有请求通过加密通道发送，返回内容仍标注「草稿·需你确认」。
        </p>
        <div v-if="cloudEndpointConfigured" class="mt-3">
          <label class="field-label">模型名称（可选）</label>
          <input
            class="input"
            type="text"
            placeholder="gpt-4o-mini"
            :value="aiModel"
            @input="onModel"
          />
        </div>
      </div>

      <p class="text-[0.78rem] text-ink-2 mt-3 leading-relaxed">
        无论哪种模式，AI 都只是镜子：产出草稿、标注「需你确认」，绝不静默替你定稿。
      </p>
    </div>

    <!-- E2EE -->
    <div class="card p-5 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <Lock :size="18" class="text-accent" />
        <h3 class="text-ink">端到端加密（E2EE）</h3>
      </div>
      <div class="flex items-center justify-between">
        <p class="text-sm text-ink-2 max-w-[80%] leading-relaxed">
          加密同步为 M3 规划。当前为本地明文存储——数据不离本机，但设备丢失即不可恢复。
        </p>
        <button
          role="switch"
          :aria-checked="e2ee"
          class="relative w-12 h-7 rounded-full transition-colors shrink-0"
          :class="e2ee ? 'bg-accent' : 'bg-line'"
          @click="toggleE2ee"
        >
          <span
            class="absolute top-1 w-5 h-5 rounded-full bg-white transition-transform"
            :class="e2ee ? 'translate-x-6' : 'translate-x-1'"
          ></span>
        </button>
      </div>
    </div>

    <!-- 审计日志 -->
    <div class="card p-5">
      <div class="flex items-center gap-2 mb-3">
        <FileText :size="18" class="text-accent" />
        <h3 class="text-ink">AI 审计日志</h3>
        <ShieldCheck :size="14" class="text-ink-2" />
      </div>
      <div v-if="auditLog.length === 0" class="text-sm text-ink-2">暂无记录。</div>
      <ul v-else class="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
        <li
          v-for="(a, i) in auditLog.slice(0, 30)"
          :key="i"
          class="flex items-center justify-between text-sm border-b border-line/50 pb-2 last:border-0"
        >
          <span class="text-ink">{{ actionLabel[a.action] || a.action }}</span>
          <span class="text-ink-2 text-xs">{{ a.detail || '' }} · {{ new Date(a.ts).toLocaleString('zh-CN') }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
