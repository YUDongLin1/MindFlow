<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Network } from 'lucide-vue-next'
import { useJournalStore } from '@/stores/journal'
import { buildGraph, findBackLinks, type GraphNode, type BackLink } from '@/services/linkGraph'

const { t } = useI18n()
const journalStore = useJournalStore()

const canvasEl = ref<HTMLCanvasElement>()
const selectedNode = ref<GraphNode | null>(null)
const backLinks = ref<BackLink[]>([])
const showGraph = ref(false)

const graphData = computed(() => buildGraph(journalStore.entries))

// Canvas 绘制
function drawGraph(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.scale(dpr, dpr)

  const { nodes, edges } = graphData.value
  if (nodes.length === 0) return

  // 力导向布局（简化版：圆形布局 + 引力）
  const cx = w / 2
  const cy = h / 2
  const positions = new Map<string, { x: number; y: number }>()

  // 标签节点在外圈，条目节点在内圈
  const tagNodes = nodes.filter(n => n.type === 'tag')
  const entryNodes = nodes.filter(n => n.type === 'entry')

  tagNodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / tagNodes.length
    const r = Math.min(w, h) * 0.38
    positions.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  })

  entryNodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / entryNodes.length + Math.PI / entryNodes.length
    const r = Math.min(w, h) * 0.2
    positions.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  })

  // 获取 CSS 变量颜色
  const style = getComputedStyle(document.documentElement)
  const accent = style.getPropertyValue('--accent').trim()
  const accentColor = accent ? `rgb(${accent})` : '#2f7e6e'
  const ink2 = style.getPropertyValue('--ink-2').trim()
  const inkColor = ink2 ? `rgb(${ink2})` : '#5b6660'
  const lineColor = style.getPropertyValue('--line').trim()
  const line = lineColor ? `rgb(${lineColor})` : '#e5decf'
  const surface = style.getPropertyValue('--surface').trim()
  const surfaceColor = surface ? `rgb(${surface})` : '#ffffff'

  // 绘制边
  ctx.strokeStyle = line + '60'
  ctx.lineWidth = 1
  for (const edge of edges) {
    const s = positions.get(edge.source)
    const t = positions.get(edge.target)
    if (s && t) {
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
    }
  }

  // 绘制节点
  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (!pos) continue

    const radius = node.type === 'tag' ? 6 + Math.min(node.count, 8) * 1.5 : 4
    const isSelected = selectedNode.value?.id === node.id

    ctx.beginPath()
    ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)

    if (node.type === 'tag') {
      ctx.fillStyle = isSelected ? accentColor : accentColor + '80'
    } else {
      ctx.fillStyle = isSelected ? inkColor : inkColor + '40'
    }
    ctx.fill()

    if (isSelected) {
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // 标签文字
    if (node.type === 'tag' && radius > 8) {
      ctx.fillStyle = inkColor
      ctx.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.label, pos.x, pos.y + radius + 14)
    }
  }

  // 存储位置用于点击检测
  ;(canvas as any).__positions = positions
  ;(canvas as any).__nodes = nodes
}

function onCanvasClick(e: MouseEvent) {
  const canvas = canvasEl.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const positions: Map<string, { x: number; y: number }> = (canvas as any).__positions
  const nodes: GraphNode[] = (canvas as any).__nodes
  if (!positions || !nodes) return

  let closest: GraphNode | null = null
  let minDist = Infinity

  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (!pos) continue
    const dist = Math.hypot(x - pos.x, y - pos.y)
    const radius = node.type === 'tag' ? 6 + Math.min(node.count, 8) * 1.5 : 4
    if (dist < radius + 4 && dist < minDist) {
      minDist = dist
      closest = node
    }
  }

  if (closest) {
    selectedNode.value = closest
    if (closest.type === 'tag') {
      backLinks.value = findBackLinks(closest.label, journalStore.entries)
    } else {
      backLinks.value = []
    }
    drawGraph(canvas)
  }
}

function refresh() {
  if (canvasEl.value && showGraph.value) {
    nextTick(() => drawGraph(canvasEl.value!))
  }
}

onMounted(refresh)
watch(() => journalStore.entries.length, refresh)
watch(showGraph, (v) => { if (v) nextTick(refresh) })
</script>

<template>
  <div class="card p-4">
    <button
      @click="showGraph = !showGraph"
      class="flex items-center gap-2 w-full text-left"
    >
      <Network :size="16" class="text-accent" />
      <span class="text-sm font-semibold text-ink">知识图谱</span>
      <span class="chip chip-soft !text-[0.6rem] ml-auto">{{ graphData.nodes.length }} 节点</span>
    </button>

    <div v-if="showGraph" class="mt-3">
      <!-- 图谱画布 -->
      <canvas
        ref="canvasEl"
        class="w-full rounded-xl bg-surface-2 cursor-pointer"
        style="height: 320px"
        @click="onCanvasClick"
      ></canvas>

      <p class="text-[0.65rem] text-ink-2/60 mt-1.5 text-center">点击节点查看详情</p>

      <!-- 选中节点详情 -->
      <div v-if="selectedNode" class="mt-3 p-3 rounded-lg bg-surface-2 border border-line/50">
        <div class="flex items-center gap-2 mb-1">
          <span
            class="w-2 h-2 rounded-full"
            :class="selectedNode.type === 'tag' ? 'bg-accent' : 'bg-ink-2'"
          ></span>
          <span class="text-sm font-medium text-ink">{{ selectedNode.label }}</span>
          <span v-if="selectedNode.type === 'tag'" class="chip chip-soft !text-[0.6rem]">
            引用 {{ selectedNode.count }} 次
          </span>
        </div>

        <!-- 反向链接列表 -->
        <div v-if="backLinks.length > 0" class="mt-2 space-y-1.5">
          <div class="text-xs text-ink-2 font-medium">被以下条目引用：</div>
          <div
            v-for="bl in backLinks.slice(0, 5)"
            :key="bl.sourceEntry.id"
            class="text-xs text-ink pl-2 border-l-2 border-accent/30"
          >
            <span class="text-ink-2">{{ bl.sourceEntry.date }} · </span>
            {{ bl.snippet }}{{ bl.snippet.length >= 80 ? '…' : '' }}
          </div>
          <div v-if="backLinks.length > 5" class="text-xs text-ink-2">
            还有 {{ backLinks.length - 5 }} 条…
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
