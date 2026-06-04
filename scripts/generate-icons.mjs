/**
 * 从 icon.svg 生成各尺寸 PNG 图标
 * 运行: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '..', 'public', 'icon.svg')

// 桌面应用图标 (256x256)
await sharp(svgPath)
  .resize(256, 256)
  .png()
  .toFile(join(__dirname, '..', 'public', 'icon.png'))

// 托盘图标 (32x32, Windows 托盘通常 16x16)
await sharp(svgPath)
  .resize(32, 32)
  .png()
  .toFile(join(__dirname, '..', 'public', 'icon-tray.png'))

console.log('✅ 图标生成完成: icon.png (256x256), icon-tray.png (32x32)')
