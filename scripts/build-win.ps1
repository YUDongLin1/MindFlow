# MindFlow Windows 打包脚本
#
# 背景：electron-builder 在复制完 188MB 的 mindflow.exe 后立刻用 Node 重写该文件
# 以写入 asar 完整性与图标/版本资源，在本机 Windows 环境下会抛
# `UNKNOWN: unknown error`（文件刚复制完尚未落盘 / 被安全软件短暂持有句柄）。
#
# 解决方案：
#   1. 预先把 Electron 发行包解压到固定目录，用 electronDist 指过去，
#      避开 electron-builder 自身的解压->重命名步骤；
#   2. 关闭 asar 完整性写入与 exe 资源编辑（signAndEditExecutable: false）；
#   3. 打包完成后，由 scripts/patch-exe.js 在独立进程里补写图标与版本信息；
#   4. 再执行一次仅做"封装安装包"的打包，把已修补的 exe 打进 NSIS。
#
# 用法：powershell -File scripts/build-win.ps1

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$electronDist = 'E:\mindflow-electron-dist'
$outDir = 'E:\mindflow-release-build'
$log = Join-Path $root 'build-win.log'

function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
  Write-Host $line
  Add-Content -Path $log -Value $line -Encoding utf8
}

Set-Content -Path $log -Value "=== MindFlow Windows build start $(Get-Date -Format o) ===" -Encoding utf8

# ---------- 0. 环境变量：使用国内镜像 ----------
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
Log "mirrors configured"

# ---------- 1. 干净构建 ----------
Log "step 1: vite build"
Set-Location $root
& npx vite build 2>&1 | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) { Log "FAILED: vite build (exit $LASTEXITCODE)"; exit 1 }
Log "vite build OK"

Log "step 2: tsc build electron main process"
Push-Location (Join-Path $root 'electron')
& node (Join-Path $root 'node_modules\typescript\bin\tsc') 2>&1 | ForEach-Object { Log "  $_" }
$tscExit = $LASTEXITCODE
Pop-Location
if ($tscExit -ne 0) { Log "FAILED: tsc (exit $tscExit)"; exit 1 }
Log "tsc OK"

# ---------- 2. 准备 Electron 发行包 ----------
if (-not (Test-Path (Join-Path $electronDist 'electron.exe'))) {
  Log "electron dist missing, extracting from cache..."
  $zip = Get-ChildItem "$env:LOCALAPPDATA\electron\Cache" -Recurse -Filter 'electron-v*-win32-x64.zip' -ErrorAction SilentlyContinue |
         Sort-Object Length -Descending | Select-Object -First 1
  if (-not $zip) { Log "FAILED: no electron zip in cache"; exit 1 }
  Log "  using $($zip.FullName) ($([math]::Round($zip.Length/1MB,1)) MB)"
  New-Item -ItemType Directory -Path $electronDist -Force | Out-Null
  Expand-Archive -Path $zip.FullName -DestinationPath $electronDist -Force
  Log "  extracted OK"
} else {
  Log "electron dist already present: $electronDist"
}

# ---------- 3. 第一轮打包（生成 win-unpacked） ----------
Log "step 3: electron-builder pack (win-unpacked only)"
if (Test-Path $outDir) {
  try { [System.IO.Directory]::Delete($outDir, $true) } catch { Log "  warn: cannot clean $outDir" }
}
& node (Join-Path $root 'node_modules\electron-builder\out\cli\cli.js') --win --x64 --dir --config (Join-Path $root 'electron-builder-override.json') 2>&1 | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) { Log "FAILED: electron-builder --dir (exit $LASTEXITCODE)"; exit 1 }
Log "win-unpacked OK"

# ---------- 4. 补写 exe 图标与版本信息 ----------
Log "step 4: patch exe resources (icon + version)"
& node (Join-Path $root 'scripts\patch-exe.js') (Join-Path $outDir 'win-unpacked\mindflow.exe') (Join-Path $root 'build-resources\icon.ico') 2>&1 | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) { Log "FAILED: patch-exe (exit $LASTEXITCODE)"; exit 1 }
Log "patch OK"

# ---------- 5. 第二轮打包（封装 NSIS 安装包） ----------
Log "step 5: electron-builder nsis installer"
& node (Join-Path $root 'node_modules\electron-builder\out\cli\cli.js') --win --x64 --prepackaged (Join-Path $outDir 'win-unpacked') --config (Join-Path $root 'electron-builder-override.json') 2>&1 | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) { Log "FAILED: electron-builder nsis (exit $LASTEXITCODE)"; exit 1 }

Log "=== build finished $(Get-Date -Format o) ==="
Get-ChildItem $outDir -Filter '*.exe' | ForEach-Object { Log ("ARTIFACT: {0}  {1:N2} MB" -f $_.Name, ($_.Length / 1MB)) }
