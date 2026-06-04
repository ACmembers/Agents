/**
 * 注册 model:// 自定义协议
 * 让渲染进程安全加载 userData/models/ 下的 Live2D 文件
 */
import { protocol, app } from 'electron'
import { join, extname } from 'path'
import { readFileSync, existsSync } from 'fs'

const MIME_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.moc3': 'application/octet-stream',
  '.moc': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mtn': 'application/octet-stream',
  '.physics3.json': 'application/json',
  '.cdi3.json': 'application/json',
  '.pose3.json': 'application/json',
  '.exp3.json': 'application/json'
}

export function registerModelProtocol(): void {
  protocol.handle('model', (request) => {
    const url = new URL(request.url)
    // model://{model-name}/path/to/file
    // hostname = model name, pathname = file path within model dir
    const modelName = url.hostname
    const filePath = url.pathname.replace(/^\//, '')

    const modelsDir = join(app.getPath('userData'), 'models')
    const fullPath = join(modelsDir, modelName, filePath)

    if (!existsSync(fullPath)) {
      return new Response('File not found', { status: 404 })
    }

    const ext = extname(fullPath).toLowerCase()
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

    try {
      const data = readFileSync(fullPath)
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      })
    } catch {
      return new Response('Read error', { status: 500 })
    }
  })
}
