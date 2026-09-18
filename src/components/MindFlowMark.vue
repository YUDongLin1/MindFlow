<script setup lang="ts">
/**
 * MindFlow 标识：一条连续流转的线（"流"），无 emoji、无 AI 紫色。
 * 线条用 currentColor，自适应主题；文字用字体排印承载品牌感。
 */
withDefaults(defineProps<{ showText?: boolean; size?: number }>(), {
  showText: true,
  size: 30,
})
</script>

<template>
  <div class="flex items-center gap-2.5 select-none">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 40 40"
      fill="none"
      class="text-accent shrink-0"
      aria-hidden="true"
    >
      <path
        d="M19 9 C 30 9, 32 21, 21 23 C 12 25, 13 33, 24 33"
        stroke="currentColor"
        stroke-width="3.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="19" cy="9" r="3.4" fill="currentColor" />
    </svg>
    <div v-if="showText" class="leading-none">
      <div class="font-display font-bold tracking-tight text-ink" style="font-size: 1.18rem">
        Mind<span class="text-accent">Flow</span>
      </div>
      <div class="text-[0.66rem] tracking-[0.32em] text-ink-2 font-medium mt-0.5">智流日志</div>
    </div>
  </div>
</template>
