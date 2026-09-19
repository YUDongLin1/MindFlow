# Build Resources

This directory contains icon files for building the application.

## Icon Requirements

For best results across all platforms, you need:

### macOS (.icns)
- Required for macOS .app bundles
- Should contain multiple resolutions: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024

### Windows (.ico)
- Required for Windows .exe files
- Should contain multiple resolutions: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256

### Linux (.png)
- 512x512 or 1024x1024 PNG works fine

## Generating icons

Every icon file is produced by one script — no manual conversion:

```bash
pip install Pillow
python scripts/generate-icon.py        # add --dry-run to just list the outputs
```

It renders the MindFlow brand mark (ink squircle + paper-white drop + flow ribbon,
from the 「纸 · 墨 · 流」 design system) and writes all platform variants:

| Target | Output |
|--------|--------|
| macOS | `icon.icns`（16 / 32 / 64 / 128 / 256 / 512 / 1024，含 @2x 条目） |
| Windows | `icon.ico`（16 / 32 / 48 / 64 / 128 / 256） + `windows-icons/icon-*.png` |
| Linux | `linux-icons/icon.png`、`linux-icons/icon-512.png` |
| Web / favicon | `public/icon.png`、`public/icon1.png` |
| iOS / Android | `public/AppIcons/**`（appiconset 全套 + mipmap + 商店图） |
| Vector source | `docs/assets/mindflow-icon.svg` |

To change the mark, edit the colour and composition constants at the top of
`scripts/generate-icon.py` and re-run — all sizes stay in sync.

## Legacy note

The previous icon set was inherited from the upstream MoodsNote project and has been
replaced. `public/screenshots/` (upstream UI captures) was removed the same way.
