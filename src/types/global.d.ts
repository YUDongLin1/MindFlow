/**
 * Global type declarations for MindFlow
 * Extends the Window interface with Electron API types
 */

/**
 * Electron API exposed via contextBridge in preload.ts
 */
export interface ElectronAPI {
  send: (channel: string, data: any) => void
  receive: (channel: string, func: (...args: any[]) => void) => void
  media: MediaAPI
  usage?: UsageAPI
  ai?: AIAPI
}

/**
 * 外部应用使用时长 API（IPC: usage:get-apps）
 * 主进程按自然日累计（含周末与节假日），返回按 seconds 降序
 */
export interface ExternalAppUsage {
  app: string
  exe: string
  seconds: number
}

export interface UsageAPI {
  getApps: () => Promise<ExternalAppUsage[]>
}

/**
 * AI 请求主进程转发 API（IPC: window.api.ai.fetch）
 * 用于规避渲染进程 CORS / 代理限制
 */
export interface AIFetchPayload {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export interface AIFetchResult {
  ok: boolean
  status: number
  headers: Record<string, string>
  bodyText: string
}

export interface AIAPI {
  fetch: (payload: AIFetchPayload) => Promise<AIFetchResult>
}

export interface MediaManifestEntry {
  id: string
  storedName: string
  originalName: string
  mimeType: string
  size: number
  checksum: string
  createdAt: string
}

export interface MediaIntegrity {
  ok: boolean
  reason?: string
}

export interface MediaAPI {
  save: (payload: { originalName: string; mimeType: string; buffer: ArrayBuffer }) => Promise<{ success: boolean; entry?: MediaManifestEntry; integrity?: MediaIntegrity; error?: string }>
  read: (payload: { id?: string; storedName?: string }) => Promise<{ success: boolean; buffer?: Buffer; entry?: MediaManifestEntry; error?: string }>
  delete: (payload: { id?: string; storedName?: string }) => Promise<{ success: boolean; error?: string }>
  getPath: () => Promise<{ success: boolean; path?: string; error?: string }>
  list: (options?: { verify?: boolean }) => Promise<{ success: boolean; files?: Array<{ entry: MediaManifestEntry; integrity: MediaIntegrity }>; error?: string }>
  open: (payload: { id?: string; storedName?: string }) => Promise<{ success: boolean; error?: string }>
  reveal: (payload: { id?: string; storedName?: string }) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

// This export is required to make this a module
export {}
