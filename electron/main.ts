import { app, BrowserWindow, ipcMain, shell, Menu, powerMonitor, net, Tray, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as crypto from 'crypto';
import * as usageMonitor from './usage-monitor';

// Extend the Electron app to include isQuitting property
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

// 便携版（electron-builder portable）每次运行解压到随机临时目录，
// 必须把 userData 固定到 exe 所在目录下，否则关闭软件后数据全部丢失。
// 必须在 app.whenReady() 及任何 app.getPath('userData') 调用之前执行。
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  const portableDataDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
  app.setPath('userData', portableDataDir);
  console.log('[portable] 便携模式，数据目录已固定为:', portableDataDir);
}

// ---------------------------------------------------------------------------
// 渲染进程沙箱与 GPU 兼容处理（必须在 app ready 之前设置）
//
// 背景：在部分 Windows 环境下（尤其是启用了第三方安全软件、或用户目录
// 带有中文/非 ASCII 路径时），Chromium 的渲染进程沙箱初始化会失败，表现为
// 窗口一闪而过、renderer 进程以 render-process-gone {reason:"killed"} 崩溃。
// 这里显式关闭渲染进程沙箱与硬件加速，避免用户必须手动追加 --no-sandbox。
// 同时保留命令行优先级：用户/CI 已显式传入的参数不被覆盖。
// ---------------------------------------------------------------------------
const userArgv = process.argv.slice(1);
const hasNoSandbox = userArgv.includes('--no-sandbox');
const hasDisableGpu = userArgv.includes('--disable-gpu');

if (process.platform === 'win32') {
  if (!hasNoSandbox) {
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-setuid-sandbox');
  }
  if (!hasDisableGpu) {
    // 部分集显/老驱动环境下 GPU 进程反复崩溃，关闭硬件加速更稳定
    app.disableHardwareAcceleration();
  }
  // 避免网络服务进程在本机网络栈上的偶发崩溃
  app.commandLine.appendSwitch('disable-features', 'NetworkServiceSandbox');
  console.log('[sandbox] Windows 兼容模式：已关闭渲染沙箱与硬件加速');
}

let mainWindow: BrowserWindow | null;
let tray: Tray | null = null;

// Get the media storage directory
function getMediaStoragePath(): string {
  const userDataPath = app.getPath('userData');
  const mediaPath = path.join(userDataPath, 'media');
  return mediaPath;
}

// Ensure media directory exists
async function ensureMediaDirectory(): Promise<void> {
  const mediaPath = getMediaStoragePath();
  try {
    await fs.access(mediaPath);
  } catch {
    await fs.mkdir(mediaPath, { recursive: true });
  }
}

// Resolve the window icon at runtime:
// - packaged builds: icons copied via electron-builder extraResources to resources/icons
// - dev fallback: public/AppIcons in the repository
function getWindowIconPath(): string | undefined {
  const iconFileName =
    process.platform === 'win32' ? 'icon-256.png'
    : process.platform === 'darwin' ? 'icon-512.png'
    : 'icon-512.png';

  if (app.isPackaged) {
    const packagedIcon = path.join(process.resourcesPath, 'icons', iconFileName);
    if (existsSync(packagedIcon)) {
      return packagedIcon;
    }
  }

  const devIcon = path.join(__dirname, '../../public/AppIcons/Assets.xcassets/AppIcon.appiconset/512.png');
  if (existsSync(devIcon)) {
    return devIcon;
  }

  return undefined;
}

// Get the tray icon path at runtime
function getTrayIconPath(): string | undefined {
  // For tray icons, use a smaller icon (16x16 or 32x32)
  const iconFileName = process.platform === 'win32' ? 'icon-256.png' : 'icon-512.png';

  if (app.isPackaged) {
    const packagedIcon = path.join(process.resourcesPath, 'icons', iconFileName);
    if (existsSync(packagedIcon)) {
      return packagedIcon;
    }
  }

  // Dev fallback
  const devIcon = path.join(__dirname, '../../public/AppIcons/Assets.xcassets/AppIcon.appiconset/512.png');
  if (existsSync(devIcon)) {
    return devIcon;
  }

  // Fallback to build-resources
  const buildIcon = path.join(__dirname, '../../build-resources/icon.ico');
  if (existsSync(buildIcon)) {
    return buildIcon;
  }

  return undefined;
}

// Create system tray with context menu
function createTray() {
  const iconPath = getTrayIconPath();
  if (!iconPath) {
    console.warn('[tray] No tray icon found, skipping tray creation');
    return;
  }

  const trayIcon = nativeImage.createFromPath(iconPath);
  // Resize for tray (16x16 on Windows, 22x22 on macOS)
  const size = process.platform === 'win32' ? 16 : 22;
  const resizedIcon = trayIcon.resize({ width: size, height: size });

  tray = new Tray(resizedIcon);
  tray.setToolTip('MindFlow');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 MindFlow',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出 MindFlow',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click to show window (Windows behavior)
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Disable Node.js integration for security
      contextIsolation: true, // Enable context isolation for security
      devTools: !app.isPackaged || !!process.env.MINDFLOW_DEVTOOLS, // DevTools disabled in packaged builds unless MINDFLOW_DEVTOOLS is set
    },
  });

  const startURL = process.env.VITE_DEV_SERVER_URL
    ? process.env.VITE_DEV_SERVER_URL
    : `file://${path.join(__dirname, '../../dist/index.html')}`;

  console.log('Loading URL:', startURL);
  console.log('__dirname:', __dirname);
  console.log('Is packaged:', app.isPackaged);

  mainWindow.loadURL(startURL);

  // Always open DevTools in production for debugging (temporary)
  // mainWindow.webContents.openDevTools();

  // Log when page loads
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
    // Notify renderer that we're running a packaged build so it can
    // enforce first-run defaults (e.g. theme) when appropriate.
    try {
      mainWindow?.webContents.send('fromMain', { type: 'app:packaged', isPackaged: app.isPackaged });
    } catch (e) {
      console.warn('Failed to notify renderer about packaged state', e);
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // On macOS, hide the window when closed instead of destroying it
  // This allows users to reopen it via the Window menu
  // On Windows/Linux, minimize to system tray instead of quitting
  mainWindow.on('close', (event: Electron.Event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      if (process.platform === 'darwin') {
        mainWindow?.hide();
      } else {
        // Windows/Linux: minimize to tray
        mainWindow?.hide();
      }
    }
  });

  // Prevent opening DevTools via keyboard shortcuts in packaged builds
  // (App Review reported developers' panel being visible when opening the DMG)
  if (app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const isF12 = input.code === 'F12'
      const isToggleDevTools = (input.key === 'I' || input.key === 'i') && (input.control || input.meta) && (input.shift || input.alt)

      if (isF12 || isToggleDevTools) {
        event.preventDefault()
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu for macOS
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const }
            ]
          }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    // Window menu
    {
      label: 'Window',
      role: 'window' as const,
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          {
            label: 'MindFlow',
            accelerator: 'CmdOrCtrl+0',
            click: () => {
              if (mainWindow) {
                if (mainWindow.isMinimized()) {
                  mainWindow.restore();
                }
                mainWindow.show();
                mainWindow.focus();
              } else {
                createWindow();
              }
            }
          }
        ] : [
          { type: 'separator' as const },
          { role: 'close' as const }
        ])
      ]
    },
    // Help menu (explicit label + role to ensure macOS shows items)
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Report an Issue',
          click: async () => {
            await shell.openExternal('https://github.com/PStarH/MoodsNote/issues');
          }
        },
        {
          label: 'View Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/PStarH/MoodsNote#readme');
          }
        },
        { type: 'separator' as const },
        {
          label: 'MindFlow Support',
          click: async () => {
            await shell.openExternal('https://github.com/PStarH/MoodsNote');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Security constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total storage
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mp3', '.wav'];
const MANIFEST_FILENAME = 'media-manifest.json';

const EXTENSION_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

interface MediaManifestEntry {
  id: string;
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  createdAt: string;
}

interface MediaIntegrity {
  ok: boolean;
  reason?: string;
}

function getManifestPath(): string {
  return path.join(getMediaStoragePath(), MANIFEST_FILENAME);
}

async function loadManifest(options: { reconcile?: boolean } = {}): Promise<MediaManifestEntry[]> {
  await ensureMediaDirectory();
  const manifestPath = getManifestPath();

  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    let parsed = JSON.parse(raw) as MediaManifestEntry[];
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid manifest content');
    }
    if (options.reconcile) {
      parsed = await ensureManifestConsistency(parsed);
    }
    return parsed;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(manifestPath, '[]', 'utf8');
      return options.reconcile ? ensureManifestConsistency([]) : [];
    }
    console.error('Failed to load media manifest:', error);
    throw error;
  }
}

async function saveManifest(entries: MediaManifestEntry[]): Promise<void> {
  const manifestPath = getManifestPath();
  const tempPath = `${manifestPath}.tmp`;
  const serialized = JSON.stringify(entries, null, 2);

  // Write to temp file first (atomic operation)
  await fs.writeFile(tempPath, serialized, 'utf8');

  // Rename is atomic on most filesystems - prevents corruption
  await fs.rename(tempPath, manifestPath);
}

function generateId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function computeChecksum(buffer: Buffer, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}

async function computeFileChecksum(filePath: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
  const hash = crypto.createHash(algorithm);
  const file = await fs.readFile(filePath);
  hash.update(file);
  return hash.digest('hex');
}

async function verifyEntry(entry: MediaManifestEntry): Promise<MediaIntegrity> {
  try {
    const mediaPath = getMediaStoragePath();
    const filePath = path.join(mediaPath, entry.storedName);
    const stats = await fs.stat(filePath);

    if (stats.size !== entry.size) {
      return { ok: false, reason: 'Size mismatch' };
    }

    const checksum = await computeFileChecksum(filePath);
    if (checksum !== entry.checksum) {
      return { ok: false, reason: 'Checksum mismatch' };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, reason: error.message };
  }
}

function detectMimeType(extension: string): string {
  return EXTENSION_MIME_MAP[extension.toLowerCase()] || 'application/octet-stream';
}

async function ensureManifestConsistency(manifest: MediaManifestEntry[]): Promise<MediaManifestEntry[]> {
  await ensureMediaDirectory();
  const mediaPath = getMediaStoragePath();
  const files = await fs.readdir(mediaPath);
  const manifestMap = new Map(manifest.map(entry => [entry.storedName, entry]));
  let changed = false;

  for (const file of files) {
    if (file === MANIFEST_FILENAME) {
      continue;
    }

    const existing = manifestMap.get(file);
    if (existing) {
      continue;
    }

    const filePath = path.join(mediaPath, file);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      continue;
    }
    const checksum = await computeFileChecksum(filePath);
    const extension = path.extname(file).toLowerCase();
    const mimeType = detectMimeType(extension);
    const createdAt = stats.birthtime instanceof Date && !Number.isNaN(stats.birthtime.valueOf())
      ? stats.birthtime.toISOString()
      : new Date().toISOString();

    const entry: MediaManifestEntry = {
      id: generateId(),
      storedName: file,
      originalName: file,
      mimeType,
      size: stats.size,
      checksum,
      createdAt,
    };

    manifest.push(entry);
    manifestMap.set(file, entry);
    changed = true;
  }

  if (changed) {
    await saveManifest(manifest);
  }

  return manifest;
}

// Validate and sanitize filename to prevent path traversal
function validateFilename(filename: string): { valid: boolean; sanitized?: string; error?: string } {
  // Check if filename exists and is a string
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Invalid filename: must be a non-empty string' };
  }

  // Check filename length
  if (filename.length > 255) {
    return { valid: false, error: 'Invalid filename: exceeds maximum length' };
  }

  // Prevent path traversal by using path.basename
  const normalizedName = path.basename(filename);

  // Check if the filename contains path traversal attempts
  if (normalizedName !== filename) {
    return { valid: false, error: 'Invalid filename: path traversal attempt detected' };
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    return { valid: false, error: 'Invalid filename: null byte detected' };
  }

  // Check file extension
  const ext = path.extname(normalizedName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Invalid file type: ${ext}. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` };
  }

  return { valid: true, sanitized: normalizedName };
}

// Check total storage size
async function checkStorageSize(additionalSize: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const manifest = await loadManifest({ reconcile: true });
    const totalSize = manifest.reduce((sum, entry) => sum + entry.size, 0);

    if (totalSize + additionalSize > MAX_TOTAL_SIZE) {
      return {
        ok: false,
        error: `Total storage limit exceeded. Current: ${(totalSize / 1024 / 1024).toFixed(2)}MB, Limit: ${MAX_TOTAL_SIZE / 1024 / 1024}MB`
      };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: `Failed to check storage size: ${error.message}` };
  }
}

// Verify file path is within media directory
function isPathSafe(filePath: string, mediaPath: string): boolean {
  const resolvedFilePath = path.resolve(filePath);
  const resolvedMediaPath = path.resolve(mediaPath);
  return resolvedFilePath.startsWith(resolvedMediaPath);
}

// IPC Handlers for media file operations

// Save media file
ipcMain.handle('media:save', async (event, payload: { originalName: string; mimeType: string; buffer: ArrayBuffer }) => {
  try {
    const { originalName, mimeType, buffer } = payload;

    // Validate filename and extension from original name
    const validation = validateFilename(originalName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    const sanitizedOriginalName = validation.sanitized!;

    // Check MIME consistency with extension
    if (!mimeType || !mimeType.startsWith('image/') && !mimeType.startsWith('video/') && !mimeType.startsWith('audio/')) {
      return { success: false, error: 'Invalid MIME type supplied' };
    }

    const fileBuffer = Buffer.from(buffer);

    // Check file size
    if (fileBuffer.byteLength > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large: ${(fileBuffer.byteLength / 1024 / 1024).toFixed(2)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
      };
    }

    // Check total storage size
    const storageCheck = await checkStorageSize(fileBuffer.byteLength);
    if (!storageCheck.ok) {
      return { success: false, error: storageCheck.error };
    }

    await ensureMediaDirectory();
    const mediaPath = getMediaStoragePath();
    const entryId = generateId();
    const extension = path.extname(sanitizedOriginalName).toLowerCase();
    const storedName = `${Date.now()}-${entryId}${extension}`;
    const filePath = path.join(mediaPath, storedName);

    // Verify path safety
    if (!isPathSafe(filePath, mediaPath)) {
      return { success: false, error: 'Access denied: invalid file path' };
    }

    // Write file to disk
    await fs.writeFile(filePath, fileBuffer);

    const checksum = computeChecksum(fileBuffer);
    const createdAt = new Date().toISOString();

    const manifest = await loadManifest({ reconcile: true });
    const entry: MediaManifestEntry = {
      id: entryId,
      storedName,
      originalName: sanitizedOriginalName,
      mimeType,
      size: fileBuffer.byteLength,
      checksum,
      createdAt,
    };

    manifest.push(entry);

    // Save manifest with rollback on failure
    try {
      await saveManifest(manifest);
    } catch (manifestError: any) {
      // Rollback: delete the file we just wrote
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Failed to rollback file after manifest error:', unlinkError);
      }
      throw new Error(`Failed to update manifest: ${manifestError.message}`);
    }

    return {
      success: true,
      entry,
      integrity: { ok: true } as MediaIntegrity,
    };
  } catch (error: any) {
    console.error('Error saving media file:', error);
    return { success: false, error: error.message };
  }
});

// Read media file
ipcMain.handle('media:read', async (event, payload: { id?: string; storedName?: string }) => {
  try {
    const { id, storedName } = payload;
    const manifest = await loadManifest({ reconcile: true });
    const entry = manifest.find(item => (id && item.id === id) || (storedName && item.storedName === storedName));

    if (!entry) {
      return { success: false, error: 'File not found in manifest' };
    }

    const mediaPath = getMediaStoragePath();
    const filePath = path.join(mediaPath, entry.storedName);

    if (!isPathSafe(filePath, mediaPath)) {
      return { success: false, error: 'Access denied: invalid file path' };
    }

    const buffer = await fs.readFile(filePath);
    return { success: true, buffer, entry };
  } catch (error: any) {
    console.error('Error reading media file:', error);
    return { success: false, error: error.message };
  }
});

// Delete media file
ipcMain.handle('media:delete', async (event, payload: { id?: string; storedName?: string }) => {
  try {
    const { id, storedName } = payload;
    const manifest = await loadManifest({ reconcile: true });
    const targetIndex = manifest.findIndex(item => (id && item.id === id) || (storedName && item.storedName === storedName));

    if (targetIndex === -1) {
      return { success: false, error: 'File not found in manifest' };
    }

    const entry = manifest[targetIndex];
    const mediaPath = getMediaStoragePath();
    const filePath = path.join(mediaPath, entry.storedName);

    if (!isPathSafe(filePath, mediaPath)) {
      return { success: false, error: 'Access denied: invalid file path' };
    }

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // If file missing, continue to clean manifest
    }

    manifest.splice(targetIndex, 1);
    await saveManifest(manifest);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting media file:', error);
    return { success: false, error: error.message };
  }
});

// Get media storage path
ipcMain.handle('media:get-path', async () => {
  try {
    await ensureMediaDirectory();
    const mediaPath = getMediaStoragePath();
    return { success: true, path: mediaPath };
  } catch (error: any) {
    console.error('Error getting media path:', error);
    return { success: false, error: error.message };
  }
});

// List all media files
ipcMain.handle('media:list', async (event, options?: { verify?: boolean }) => {
  try {
    await ensureMediaDirectory();
    const verify = options?.verify ?? false;
    const mediaPath = getMediaStoragePath();
    const manifest = await loadManifest({ reconcile: true });

    const filesWithIntegrity = await Promise.all(manifest.map(async entry => {
      const filePath = path.join(mediaPath, entry.storedName);
      let integrity: MediaIntegrity = { ok: true };

      try {
        await fs.access(filePath);
        if (verify) {
          integrity = await verifyEntry(entry);
        }
      } catch (error: any) {
        integrity = { ok: false, reason: error.message };
      }

      return { entry, integrity };
    }));

    return {
      success: true,
      files: filesWithIntegrity,
    };
  } catch (error: any) {
    console.error('Error listing media files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('media:open', async (event, payload: { id?: string; storedName?: string }) => {
  try {
    const { id, storedName } = payload;
    const manifest = await loadManifest({ reconcile: true });
    const entry = manifest.find(item => (id && item.id === id) || (storedName && item.storedName === storedName));

    if (!entry) {
      return { success: false, error: 'File not found in manifest' };
    }

    const mediaPath = getMediaStoragePath();
    const filePath = path.join(mediaPath, entry.storedName);

    if (!isPathSafe(filePath, mediaPath)) {
      return { success: false, error: 'Access denied: invalid file path' };
    }

    const result = await shell.openPath(filePath);
    if (result) {
      return { success: false, error: result };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error opening media file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('media:reveal', async (event, payload: { id?: string; storedName?: string }) => {
  try {
    const { id, storedName } = payload;
    const manifest = await loadManifest({ reconcile: true });
    const entry = manifest.find(item => (id && item.id === id) || (storedName && item.storedName === storedName));

    if (!entry) {
      return { success: false, error: 'File not found in manifest' };
    }

    const mediaPath = getMediaStoragePath();
    const filePath = path.join(mediaPath, entry.storedName);

    if (!isPathSafe(filePath, mediaPath)) {
      return { success: false, error: 'Access denied: invalid file path' };
    }

    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error: any) {
    console.error('Error revealing media file:', error);
    return { success: false, error: error.message };
  }
});


// ---- Storage Path Management ----
const STORAGE_CONFIG_FILE = 'mindflow-storage-config.json';

function getStorageConfigPath(): string {
  return path.join(app.getPath('userData'), STORAGE_CONFIG_FILE);
}

interface StorageConfig {
  dataPath: string;
}

async function loadStorageConfig(): Promise<StorageConfig> {
  const configPath = getStorageConfigPath();
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.dataPath === 'string') {
      return { dataPath: parsed.dataPath };
    }
  } catch {}
  return { dataPath: app.getPath('userData') };
}

async function saveStorageConfig(config: StorageConfig): Promise<void> {
  const configPath = getStorageConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

ipcMain.handle('storage:get-path', async () => {
  try {
    const config = await loadStorageConfig();
    return { success: true, currentPath: config.dataPath, defaultPath: app.getPath('userData'), appPath: app.getAppPath() };
  } catch (error: any) { return { success: false, error: error.message }; }
});

ipcMain.handle('storage:set-path', async (event: any, newPath: string) => {
  try {
    if (!newPath || typeof newPath !== 'string') return { success: false, error: 'Path cannot be empty' };
    const resolvedPath = path.resolve(newPath);
    await fs.mkdir(resolvedPath, { recursive: true });
    const testFile = path.join(resolvedPath, '.mindflow-test');
    await fs.writeFile(testFile, 'test', 'utf8');
    await fs.unlink(testFile);
    await saveStorageConfig({ dataPath: resolvedPath });
    return { success: true, newPath: resolvedPath };
  } catch (error: any) { return { success: false, error: error.message }; }
});

ipcMain.handle('storage:pick-folder', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'], title: '\u9009\u62e9\u6570\u636e\u5b58\u50a8\u4f4d\u7f6e' });
  if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'cancelled' };
  return { success: true, path: result.filePaths[0] };
});

// ---- Foreground App Detection / Usage Time Monitoring ----
// 采样与累计逻辑已迁移到 ./usage-monitor（常驻 PowerShell 子进程，异步非阻塞）。
// 此处 IPC handler 保持既有返回契约不变。

ipcMain.handle('usage:get-foreground-app', async () => {
  try {
    const summary = usageMonitor.getLegacySummary();
    return { success: true, currentApp: summary.currentApp, apps: summary.apps };
  } catch (error: any) { return { success: false, error: error.message }; }
});

// 当日全量排行，契约：Array<{ app: string; exe: string; seconds: number }>，按 seconds 降序
ipcMain.handle('usage:get-apps', async () => {
  try {
    return usageMonitor.getRanking();
  } catch (error: any) { return []; }
});

ipcMain.handle('usage:reset-daily', async () => {
  usageMonitor.resetDaily();
  return { success: true };
});

// ---- AI 请求主进程转发 ----
// 渲染层通过 preload 的 window.api.ai.fetch(payload) 调用。
// 使用 Electron net.fetch：自动走系统代理，且不会携带 file:// 页面的 Origin:null 头。
//
// 错误约定（与渲染层保持一致）：
// - URL 未通过白名单校验 / payload 非法 / 网络错误 / 超时：handler 抛出带 message 的 Error，
//   invoke 的 Promise 被 reject，渲染层需用 try/catch 感知；
// - HTTP 非 2xx：正常 resolve，返回 { ok: false, status, headers, bodyText }，由业务层判断。

interface AiFetchPayload {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

interface AiFetchResult {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  bodyText: string;
}

ipcMain.handle('ai:fetch', async (_event, payload: AiFetchPayload): Promise<AiFetchResult> => {
  if (!payload || typeof payload.url !== 'string' || !payload.url) {
    throw new Error('ai:fetch: invalid payload (url required)');
  }

  // URL 白名单：仅允许 https://，或 http://localhost（任意端口）
  let parsed: URL;
  try {
    parsed = new URL(payload.url);
  } catch {
    throw new Error('ai:fetch: invalid URL');
  }
  const isLocalhost =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) {
    throw new Error('ai:fetch: URL not allowed by whitelist');
  }

  const timeoutMs =
    typeof payload.timeoutMs === 'number' && payload.timeoutMs > 0 ? payload.timeoutMs : 30000;

  const resp = await net.fetch(payload.url, {
    method: payload.method || 'GET',
    headers: payload.headers,
    body: payload.body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const headers: Record<string, string> = {};
  resp.headers.forEach((value, key) => { headers[key] = value; });
  const bodyText = await resp.text();

  return { ok: resp.ok, status: resp.status, headers, bodyText };
});

app.whenReady().then(() => {
  createMenu();
  createTray();
  createWindow();

  // 使用时长监测：仅 Windows 启用（模块内部对非 win32 平台优雅跳过）
  if (process.platform === 'win32') {
    usageMonitor.start();
    // 锁屏/休眠暂停采样，解锁/恢复后重新采样
    powerMonitor.on('lock-screen', () => usageMonitor.pause());
    powerMonitor.on('suspend', () => usageMonitor.pause());
    powerMonitor.on('unlock-screen', () => usageMonitor.resume());
    powerMonitor.on('resume', () => usageMonitor.resume());
  }

  app.on('activate', () => {
    // On macOS, show the window if it exists but is hidden
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running (dock behavior)
  // On Windows/Linux with tray, keep app running in background
  // Only quit if isQuitting is explicitly set (via tray menu "Exit")
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

// Handle app quit properly on macOS
app.on('before-quit', () => {
  app.isQuitting = true;
  // 停止采样并显式 kill 常驻 PowerShell 子进程，同步落盘当日数据
  usageMonitor.stop();
});
