/**
 * 后置修正脚本：把应用图标与版本元数据写入 win-unpacked/mindflow.exe
 *
 * 背景：electron-builder 的 signAndEditExecutable 会在复制完 188MB 的 exe 后
 * 立刻用 Node 的 writeFile 重写该文件，在部分 Windows 环境（杀软实时扫描 /
 * 文件延迟落盘）下会抛 `UNKNOWN: unknown error`。因此打包时跳过该步骤，
 * 改为打包完成后在独立进程里补做同样的工作。
 *
 * 使用与 electron-builder 完全相同的 resedit 库，效果等价。
 */
const fs = require('fs');
const path = require('path');

const exePath = process.argv[2] || 'E:\\mindflow-release-build\\win-unpacked\\mindflow.exe';
const icoPath = process.argv[3] || 'E:\\研究生文件\\moodnote\\build-resources\\icon.ico';

const result = [];

function log(m) { result.push(m); console.log(m); }

if (!fs.existsSync(exePath)) {
  log('ERROR: exe not found: ' + exePath);
  process.exit(1);
}

const resedit = require('resedit');
const { NtExecutable, NtExecutableResource, Resource, Data } = resedit;

// Windows 里 exe 可能被短暂占用，做几次重试
function withRetry(fn, label, maxTry = 8) {
  for (let i = 1; i <= maxTry; i++) {
    try {
      fn();
      log(`${label}: OK (attempt ${i})`);
      return true;
    } catch (e) {
      log(`${label}: attempt ${i} failed -> ${e.code || ''} ${e.message}`);
      if (i === maxTry) throw e;
      // 同步忙等，让文件句柄/落盘完成
      const until = Date.now() + 1200 * i;
      while (Date.now() < until) { /* busy wait */ }
    }
  }
}

try {
  const buffer = fs.readFileSync(exePath);
  const executable = NtExecutable.from(buffer);
  const resource = NtExecutableResource.from(executable);

  // --- 1) 写入图标 ---
  if (fs.existsSync(icoPath)) {
    const icoBuf = fs.readFileSync(icoPath);
    // 取尺寸最大的一组图标
    const iconFile = Data.IconFile.from(icoBuf);
    Resource.IconGroupEntry.replaceIconsForResource(
      resource.entries,
      1,
      1033,
      iconFile.icons.map((item) => item.data)
    );
    log('icon replaced from ' + path.basename(icoPath) + ' (' + iconFile.icons.length + ' sizes)');
  } else {
    log('WARN: ico not found, skip icon: ' + icoPath);
  }

  // --- 2) 写入版本信息 ---
  // Electron 自带一个版本信息块，先移除旧的再写入新的，避免出现两个块。
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const productName = (pkg.build && pkg.build.productName) || pkg.name;
  const version = pkg.version;
  const description = pkg.description || '';
  const company = (pkg.author && pkg.author.name) || productName;
  const copyright = `Copyright © ${new Date().getFullYear()} ${company}`;

  // 删除已有的 VERSION 资源条目
  const before = resource.entries.length;
  for (let i = resource.entries.length - 1; i >= 0; i--) {
    const e = resource.entries[i];
    if (e.type === 16 /* RT_VERSION */) {
      resource.entries.splice(i, 1);
    }
  }
  log(`removed ${before - resource.entries.length} existing VERSION entry(ies)`);

  const vi = Resource.VersionInfo.createEmpty();
  vi.setFileVersion(version, 1033);
  vi.setProductVersion(version, 1033);
  vi.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      ProductName: productName,
      FileDescription: description,
      CompanyName: company,
      LegalCopyright: copyright,
      OriginalFilename: path.basename(exePath),
      InternalName: pkg.name,
      ProductVersion: version,
      FileVersion: version,
    }
  );
  vi.outputToResourceEntries(resource.entries);
  log('version info set: ' + productName + ' ' + version);

  resource.outputResource(executable);
  const out = Buffer.from(executable.generate());

  // --- 3) 写回（带重试）---
  withRetry(() => fs.writeFileSync(exePath, out), 'write exe');
  log('final exe size: ' + fs.statSync(exePath).size);
  log('DONE');
} catch (e) {
  log('FAILED: ' + e.message);
  fs.writeFileSync(path.join(__dirname, '..', 'patch-exe-result.txt'), result.join('\n'), 'utf8');
  process.exit(1);
}

fs.writeFileSync(path.join(__dirname, '..', 'patch-exe-result.txt'), result.join('\n'), 'utf8');
