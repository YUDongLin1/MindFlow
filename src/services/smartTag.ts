/**
 * 智能标签提取服务
 * 基于 TF-IDF 简化版 + 中文分词 + AI 辅助
 */

// 停用词（高频无意义词）
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '他', '她', '它', '们', '那', '被', '从', '对', '把', '让', '给',
  '但', '而', '又', '或', '如果', '因为', '所以', '虽然', '但是', '可以', '这个',
  '那个', '什么', '怎么', '为什么', '哪', '多少', '几', '一些', '每个', '所有',
  '今天', '明天', '昨天', '还是', '已经', '正在', '将要', '可能', '应该', '需要',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'and', 'but', 'or', 'if', 'then', 'else', 'when', 'where', 'how', 'what', 'which',
  'who', 'whom', 'why', 'not', 'no', 'nor', 'so', 'very', 'too', 'also',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'out',
])

/**
 * 简单中文分词：按标点/空格分割 + 2-4 字滑动窗口提取词组
 */
function tokenize(text: string): string[] {
  const cleaned = text
    .replace(/<[^>]*>/g, ' ')  // strip HTML
    .replace(/[，。！？、；：""''（）【】《》\s\n\r\t.,!?;:'"()\[\]{}<>@#$%^&*+=|\\/`~]+/g, ' ')
    .toLowerCase()
    .trim()

  const tokens: string[] = []

  // 按空格分词
  for (const word of cleaned.split(/\s+/)) {
    if (word.length < 2) continue
    if (STOP_WORDS.has(word)) continue
    if (/^\d+$/.test(word)) continue // 纯数字
    tokens.push(word)
  }

  // 中文 2-4 字滑动窗口
  const chineseRuns = cleaned.match(/[\u4e00-\u9fff]+/g) || []
  for (const run of chineseRuns) {
    if (run.length <= 1) continue
    for (let len = Math.min(run.length, 4); len >= 2; len--) {
      for (let i = 0; i <= run.length - len; i++) {
        const gram = run.slice(i, i + len)
        if (!STOP_WORDS.has(gram)) {
          tokens.push(gram)
        }
      }
    }
  }

  return tokens
}

/**
 * 基于 TF 提取候选标签
 */
export function extractTagsFromText(text: string, existingTags: string[] = [], maxTags: number = 5): string[] {
  if (!text || text.trim().length < 10) return []

  const tokens = tokenize(text)
  const tf = new Map<string, number>()

  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1)
  }

  // 已有标签加分
  for (const tag of existingTags) {
    const lower = tag.toLowerCase()
    if (tf.has(lower)) {
      tf.set(lower, (tf.get(lower) || 0) + 2) // 加权
    }
  }

  // 排序：频次降序，长度适中的优先
  const sorted = Array.from(tf.entries())
    .filter(([word, count]) => count >= 1 && word.length >= 2 && word.length <= 8)
    .sort((a, b) => {
      // 优先高频词
      if (b[1] !== a[1]) return b[1] - a[1]
      // 相同频次优先 2-4 字的
      const lenScore = (w: string) => {
        const len = w.length
        if (len >= 2 && len <= 4) return 0
        return 1
      }
      return lenScore(a[0]) - lenScore(b[0])
    })

  return sorted.slice(0, maxTags).map(([word]) => word)
}

/**
 * 从所有条目中获取全局标签库（按频次排序）
 */
export function getGlobalTagLibrary(entries: { tags: string[] }[]): { tag: string; count: number }[] {
  const countMap = new Map<string, number>()
  for (const entry of entries) {
    for (const tag of entry.tags) {
      countMap.set(tag, (countMap.get(tag) || 0) + 1)
    }
  }
  return Array.from(countMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}
