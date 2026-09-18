<script setup lang="ts">
import { ref } from 'vue'
import { Plus, X, Save, Trash2, Settings, GripVertical } from 'lucide-vue-next'
import { useJournalStore, type CustomModule } from '@/stores/journal'

const journalStore = useJournalStore()

const showCreate = ref(false)
const editingId = ref<string | null>(null)

// 新模块表单
const formName = ref('')
const formIcon = ref('FileText')
const formPrompts = ref<{ id: string; label: string; placeholder: string }[]>([
  { id: 'content', label: '内容', placeholder: '记录点什么…' },
])

function resetForm() {
  formName.value = ''
  formIcon.value = 'FileText'
  formPrompts.value = [{ id: 'content', label: '内容', placeholder: '记录点什么…' }]
  editingId.value = null
}

function startCreate() {
  resetForm()
  showCreate.value = true
}

function startEdit(mod: CustomModule) {
  editingId.value = mod.id
  formName.value = mod.name
  formIcon.value = mod.icon
  formPrompts.value = mod.prompts.map(p => ({ ...p }))
  showCreate.value = true
}

function addPromptField() {
  const id = 'field_' + Date.now().toString(36)
  formPrompts.value.push({ id, label: '', placeholder: '' })
}

function removePromptField(index: number) {
  if (formPrompts.value.length > 1) {
    formPrompts.value.splice(index, 1)
  }
}

async function saveModule() {
  if (!formName.value.trim()) return

  const validPrompts = formPrompts.value.filter(p => p.label.trim())
  if (validPrompts.length === 0) return

  // 为没有 id 的 prompt 生成 id
  const prompts = validPrompts.map(p => ({
    id: p.id || ('field_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4)),
    label: p.label.trim(),
    placeholder: p.placeholder || '记录点什么…',
  }))

  if (editingId.value) {
    await journalStore.updateCustomModule(editingId.value, {
      name: formName.value.trim(),
      icon: formIcon.value,
      prompts,
    })
  } else {
    await journalStore.addCustomModule({
      name: formName.value.trim(),
      icon: formIcon.value,
      prompts,
    })
  }

  showCreate.value = false
  resetForm()
}

async function deleteModule(id: string) {
  if (confirm('确定删除此自定义模块？已有的记录不会被删除。')) {
    await journalStore.deleteCustomModule(id)
  }
}

function cancel() {
  showCreate.value = false
  resetForm()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <h2 class="flex items-center gap-2">
        <Settings :size="18" class="text-accent" />
        自定义记录模块
      </h2>
      <button
        v-if="!showCreate"
        class="btn btn-primary !text-sm"
        @click="startCreate"
      >
        <Plus :size="14" /> 新建模块
      </button>
    </div>

    <p class="text-sm text-ink-2 mb-4">
      创建自定义记录类型，定义专属的字段模板。自定义模块同样支持 AI 复盘。
    </p>

    <!-- 已有自定义模块列表 -->
    <div v-if="journalStore.customModules.length > 0 && !showCreate" class="space-y-2 mb-4">
      <div
        v-for="mod in journalStore.customModules"
        :key="mod.id"
        class="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-line/50"
      >
        <div>
          <div class="text-sm font-medium text-ink">{{ mod.name }}</div>
          <div class="text-xs text-ink-2 mt-0.5">{{ mod.prompts.length }} 个字段</div>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-ghost !p-1.5" @click="startEdit(mod)" title="编辑">
            <Settings :size="14" />
          </button>
          <button class="btn btn-ghost !p-1.5 text-danger" @click="deleteModule(mod.id)" title="删除">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- 创建/编辑表单 -->
    <div v-if="showCreate" class="card p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-ink">
          {{ editingId ? '编辑模块' : '新建模块' }}
        </h3>
        <button class="btn btn-ghost !p-1" @click="cancel">
          <X :size="16" />
        </button>
      </div>

      <div>
        <label class="field-label">模块名称</label>
        <input class="input" v-model="formName" placeholder="例如：健身记录 / 读书笔记 / 项目复盘" />
      </div>

      <div>
        <label class="field-label">记录字段</label>
        <div class="space-y-2">
          <div
            v-for="(p, idx) in formPrompts"
            :key="idx"
            class="flex gap-2 items-start"
          >
            <div class="flex-1 grid grid-cols-2 gap-2">
              <input
                class="input !py-1.5 text-sm"
                v-model="p.label"
                placeholder="字段名称"
              />
              <input
                class="input !py-1.5 text-sm"
                v-model="p.placeholder"
                placeholder="提示文字"
              />
            </div>
            <button
              v-if="formPrompts.length > 1"
              class="text-ink-2/40 hover:text-danger transition-colors mt-1.5"
              @click="removePromptField(idx)"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
        <button
          class="flex items-center gap-1 text-sm text-ink-2 hover:text-accent transition-colors mt-2"
          @click="addPromptField"
        >
          <Plus :size="14" />
          添加字段
        </button>
      </div>

      <div class="flex gap-2 justify-end pt-2 border-t border-line/50">
        <button class="btn btn-ghost" @click="cancel">取消</button>
        <button
          class="btn btn-primary"
          @click="saveModule"
          :disabled="!formName.trim() || formPrompts.every(p => !p.label.trim())"
        >
          <Save :size="14" />
          {{ editingId ? '保存修改' : '创建模块' }}
        </button>
      </div>
    </div>
  </div>
</template>
