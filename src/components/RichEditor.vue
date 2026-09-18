<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, Quote, Heading1, Heading2, Code, Undo, Redo, X } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  minimal?: boolean  // 最小工具栏模式
  editable?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  content: props.modelValue || '',
  editable: props.editable !== false,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: { HTMLAttributes: { class: 'tiptap-code-block' } },
      blockquote: { HTMLAttributes: { class: 'tiptap-blockquote' } },
    }),
    Placeholder.configure({
      placeholder: props.placeholder || '开始记录…',
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'tiptap-link' },
    }),
    Underline,
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
  editorProps: {
    attributes: {
      class: 'tiptap-editor prose prose-sm max-w-none focus:outline-none',
    },
  },
})

// 外部内容变化时同步到编辑器
watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  const current = editor.value.getHTML()
  if (val !== current) {
    editor.value.commands.setContent(val || '', { emitUpdate: false })
  }
})

// 可编辑状态变化
watch(() => props.editable, (val) => {
  editor.value?.setEditable(val !== false)
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function setLink() {
  if (!editor.value) return
  const previousUrl = editor.value.getAttributes('link').href
  const url = window.prompt('输入链接 URL', previousUrl || 'https://')
  if (url === null) return // 用户取消
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function toggleHeading(level: 1 | 2) {
  editor.value?.chain().focus().toggleHeading({ level }).run()
}

const isMinimal = props.minimal
</script>

<template>
  <div class="tiptap-wrapper rounded-xl border border-line bg-surface overflow-hidden transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20">
    <!-- 工具栏 -->
    <div v-if="editable !== false && editor" class="flex items-center gap-0.5 px-2 py-1.5 border-b border-line/50 bg-surface-2 flex-wrap">
      <button
        v-if="!isMinimal"
        @click="editor.chain().focus().undo().run()"
        :disabled="!editor.can().undo()"
        class="toolbar-btn"
        title="撤销"
      >
        <Undo :size="14" />
      </button>
      <button
        v-if="!isMinimal"
        @click="editor.chain().focus().redo().run()"
        :disabled="!editor.can().redo()"
        class="toolbar-btn"
        title="重做"
      >
        <Redo :size="14" />
      </button>

      <span v-if="!isMinimal" class="w-px h-4 bg-line/50 mx-1"></span>

      <button
        @click="editor.chain().focus().toggleBold().run()"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('bold') }"
        class="toolbar-btn"
        title="粗体"
      >
        <Bold :size="14" />
      </button>
      <button
        @click="editor.chain().focus().toggleItalic().run()"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('italic') }"
        class="toolbar-btn"
        title="斜体"
      >
        <Italic :size="14" />
      </button>
      <button
        @click="editor.chain().focus().toggleUnderline().run()"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('underline') }"
        class="toolbar-btn"
        title="下划线"
      >
        <UnderlineIcon :size="14" />
      </button>

      <span class="w-px h-4 bg-line/50 mx-1"></span>

      <button
        v-if="!isMinimal"
        @click="toggleHeading(1)"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('heading', { level: 1 }) }"
        class="toolbar-btn"
        title="标题 1"
      >
        <Heading1 :size="14" />
      </button>
      <button
        v-if="!isMinimal"
        @click="toggleHeading(2)"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('heading', { level: 2 }) }"
        class="toolbar-btn"
        title="标题 2"
      >
        <Heading2 :size="14" />
      </button>

      <span v-if="!isMinimal" class="w-px h-4 bg-line/50 mx-1"></span>

      <button
        @click="editor.chain().focus().toggleBulletList().run()"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('bulletList') }"
        class="toolbar-btn"
        title="无序列表"
      >
        <List :size="14" />
      </button>
      <button
        @click="editor.chain().focus().toggleOrderedList().run()"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('orderedList') }"
        class="toolbar-btn"
        title="有序列表"
      >
        <ListOrdered :size="14" />
      </button>
      <button
        v-if="!isMinimal"
        @click="editor.chain().focus().toggleBlockquote().run()"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('blockquote') }"
        class="toolbar-btn"
        title="引用"
      >
        <Quote :size="14" />
      </button>
      <button
        v-if="!isMinimal"
        @click="editor.chain().focus().toggleCodeBlock().run()"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('codeBlock') }"
        class="toolbar-btn"
        title="代码块"
      >
        <Code :size="14" />
      </button>

      <span class="w-px h-4 bg-line/50 mx-1"></span>

      <button
        @click="setLink"
        :class="{ 'bg-accent-soft text-accent': editor.isActive('link') }"
        class="toolbar-btn"
        title="链接"
      >
        <LinkIcon :size="14" />
      </button>
      <button
        v-if="editor.isActive('link')"
        @click="editor.chain().focus().unsetLink().run()"
        class="toolbar-btn text-danger"
        title="移除链接"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- 编辑区 -->
    <EditorContent :editor="editor" class="tiptap-content" />
  </div>
</template>

<style scoped>
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  color: rgb(var(--ink-2));
  transition: all 0.15s ease;
  cursor: pointer;
  flex-shrink: 0;
}
.toolbar-btn:hover {
  background: rgb(var(--surface-2));
  color: rgb(var(--ink));
}
.toolbar-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 编辑区 */
.tiptap-content :deep(.tiptap-editor) {
  padding: 0.75rem 1rem;
  min-height: 80px;
  font-size: 0.9rem;
  line-height: 1.65;
  color: rgb(var(--ink));
}
.tiptap-content :deep(.tiptap-editor:focus) {
  outline: none;
}

/* Placeholder */
.tiptap-content :deep(.tiptap-editor p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: rgb(var(--ink-2) / 0.5);
  pointer-events: none;
  height: 0;
}

/* 标题 */
.tiptap-content :deep(h1) { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0 0.5rem; }
.tiptap-content :deep(h2) { font-size: 1.25rem; font-weight: 650; margin: 0.5rem 0 0.35rem; }
.tiptap-content :deep(h3) { font-size: 1.1rem; font-weight: 600; margin: 0.4rem 0 0.25rem; }

/* 列表 */
.tiptap-content :deep(ul) { padding-left: 1.25rem; list-style: disc; }
.tiptap-content :deep(ol) { padding-left: 1.25rem; list-style: decimal; }
.tiptap-content :deep(li) { margin: 0.15rem 0; }

/* 引用 */
.tiptap-content :deep(blockquote) {
  border-left: 3px solid rgb(var(--accent));
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: rgb(var(--ink-2));
  font-style: italic;
}

/* 代码块 */
.tiptap-content :deep(pre) {
  background: rgb(var(--surface-2));
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.82rem;
  overflow-x: auto;
}
.tiptap-content :deep(code) {
  background: rgb(var(--surface-2));
  border-radius: 3px;
  padding: 0.1em 0.3em;
  font-size: 0.85em;
}
.tiptap-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

/* 链接 */
.tiptap-content :deep(.tiptap-link) {
  color: rgb(var(--accent));
  text-decoration: underline;
  cursor: pointer;
}

/* 空段落 */
.tiptap-content :deep(p) {
  margin: 0.25rem 0;
}
</style>
