import { contextBridge, ipcRenderer } from 'electron'

export interface StorageAPI {
  getPath: () => Promise<{ success: boolean; currentPath?: string; defaultPath?: string; appPath?: string; error?: string }>
  setPath: (newPath: string) => Promise<{ success: boolean; newPath?: string; error?: string }>
  pickFolder: () => Promise<{ success: boolean; path?: string; error?: string }>
}

export interface UsageAPI {
  getForegroundApp: () => Promise<{ success: boolean; currentApp?: string; apps?: Array<{ appName: string; durationMs: number }>; error?: string }>
  getApps: () => Promise<Array<{ app: string; exe: string; seconds: number }>>
  resetDaily: () => Promise<{ success: boolean }>
}

export interface AiFetchPayload {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export interface AiFetchResult {
  ok: boolean
  status: number
  headers: Record<string, string>
  bodyText: string
}

export interface AiAPI {
  fetch: (payload: AiFetchPayload) => Promise<AiFetchResult>
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

export interface ElectronAPI {
  send: (channel: string, data: any) => void
  receive: (channel: string, func: (...args: any[]) => void) => void
  storage: StorageAPI
  usage: UsageAPI
  media: MediaAPI
  ai: AiAPI
}

contextBridge.exposeInMainWorld('api', {
  send: (channel: string, data: any) => {
    const validChannels = ['toMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  receive: (channel: string, func: (...args: any[]) => void) => {
    const validChannels = ['fromMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  },
  storage: {
    getPath: () => ipcRenderer.invoke('storage:get-path'),
    setPath: (newPath: string) => ipcRenderer.invoke('storage:set-path', newPath),
    pickFolder: () => ipcRenderer.invoke('storage:pick-folder'),
  },
  usage: {
    getForegroundApp: () => ipcRenderer.invoke('usage:get-foreground-app'),
    getApps: () => ipcRenderer.invoke('usage:get-apps'),
    resetDaily: () => ipcRenderer.invoke('usage:reset-daily'),
  },
  media: {
    save: (payload: { originalName: string; mimeType: string; buffer: ArrayBuffer }) =>
      ipcRenderer.invoke('media:save', payload),
    read: (payload: { id?: string; storedName?: string }) =>
      ipcRenderer.invoke('media:read', payload),
    delete: (payload: { id?: string; storedName?: string }) =>
      ipcRenderer.invoke('media:delete', payload),
    getPath: () =>
      ipcRenderer.invoke('media:get-path'),
    list: (options?: { verify?: boolean }) =>
      ipcRenderer.invoke('media:list', options),
    open: (payload: { id?: string; storedName?: string }) =>
      ipcRenderer.invoke('media:open', payload),
    reveal: (payload: { id?: string; storedName?: string }) =>
      ipcRenderer.invoke('media:reveal', payload),
  } as MediaAPI,
  ai: {
    fetch: (payload: AiFetchPayload) => ipcRenderer.invoke('ai:fetch', payload),
  } as AiAPI,
})

declare global {
  interface Window {
    api: ElectronAPI
  }
}

window.addEventListener('DOMContentLoaded', () => {})
