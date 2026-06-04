import { useState, useCallback, useRef } from 'react'
import {
  Upload, Package, Star, Trash2, Eye, Image as ImageIcon,
  Check, AlertCircle, Loader2, X, FileWarning, Box
} from 'lucide-react'
import { useDashboardStore } from '../stores/dashboardStore'
import type { ModelMeta } from '../types'

interface ImportState {
  status: 'idle' | 'validating' | 'importing' | 'success' | 'error'
  message: string
  modelName: string
}

export default function ModelManager() {
  const { modelConfig, setActiveModel, addModel, removeModel } = useDashboardStore()
  const [dragOver, setDragOver] = useState(false)
  const [importState, setImportState] = useState<ImportState>({
    status: 'idle', message: '', modelName: ''
  })
  const [previewModel, setPreviewModel] = useState<ModelMeta | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = useCallback(
    async (files: FileList | File[]) => {
      setImportState({ status: 'validating', message: '正在验证文件...', modelName: '' })

      // 验证
      const fileArray = Array.from(files)
      const hasModelJson = fileArray.some(
        (f) => f.name.endsWith('.model3.json') || f.name.endsWith('.model.json')
      )
      const hasMoc = fileArray.some(
        (f) => f.name.endsWith('.moc3') || f.name.endsWith('.moc')
      )
      const hasTexture = fileArray.some(
        (f) => f.webkitRelativePath?.includes('textures') || f.name.endsWith('.png')
      )

      if (!hasModelJson) {
        setImportState({
          status: 'error',
          message: '⚠️ 仅支持 Live2D Cubism 3/4 格式的模型，请检查文件是否完整（需要 .model3.json 或 .model.json）',
          modelName: ''
        })
        setTimeout(() => setImportState({ status: 'idle', message: '', modelName: '' }), 5000)
        return
      }
      if (!hasMoc) {
        setImportState({
          status: 'error',
          message: '⚠️ 缺少 .moc3 / .moc 骨骼文件',
          modelName: ''
        })
        setTimeout(() => setImportState({ status: 'idle', message: '', modelName: '' }), 5000)
        return
      }

      // 模拟导入
      const modelName = fileArray
        .find((f) => f.name.endsWith('.model3.json') || f.name.endsWith('.model.json'))
        ?.name.replace(/\.model3?\.json$/, '') || '未命名模型'

      setImportState({ status: 'importing', message: `正在导入 "${modelName}"...`, modelName })

      // 模拟延迟
      await new Promise((r) => setTimeout(r, 1500))

      addModel({
        name: modelName,
        path: modelName.toLowerCase().replace(/\s+/g, '-'),
        model3Json: `${modelName}.model3.json`,
        thumbnail: undefined
      })

      setImportState({ status: 'success', message: `"${modelName}" 导入成功！`, modelName })
      setTimeout(() => setImportState({ status: 'idle', message: '', modelName: '' }), 3000)
    },
    [addModel]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleImport(e.dataTransfer.files)
      }
    },
    [handleImport]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleImport(e.target.files)
      }
    },
    [handleImport]
  )

  const handleDelete = useCallback(
    (name: string) => {
      if (name === modelConfig.activeModel) return
      if (confirm(`确认删除模型 "${name}"？此操作不可恢复。`)) {
        removeModel(name)
      }
    },
    [modelConfig.activeModel, removeModel]
  )

  const handleSetActive = useCallback(
    (name: string) => {
      setActiveModel(name)
    },
    [setActiveModel]
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slateblue-900">模型管理</h2>
          <p className="text-sm text-slateblue-400 mt-1">
            导入和管理 Live2D 角色模型 — 仅支持 Cubism 3/4 格式
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> 导入模型
        </button>
        <input
          ref={fileInputRef}
          type="file"
          // @ts-ignore webkitdirectory
          webkitdirectory="true"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`drop-zone ${dragOver ? 'dragover' : ''} ${
          importState.status !== 'idle' ? 'pointer-events-none' : ''
        }`}
      >
        {importState.status === 'idle' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-slateblue-100 flex items-center justify-center mb-1">
              <Package className="w-7 h-7 text-slateblue-400" />
            </div>
            <p className="text-sm font-medium text-slateblue-600">
              拖拽 Live2D 模型文件夹到这里
            </p>
            <p className="text-xs text-slateblue-400">
              或点击右上角"导入模型"选择文件夹 · 支持 Cubism 3/4
            </p>
          </>
        )}

        {importState.status === 'validating' && (
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-phoebe-500 animate-spin" />
            <span className="text-sm text-slateblue-600">{importState.message}</span>
          </div>
        )}

        {importState.status === 'importing' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-phoebe-500 animate-spin" />
            <span className="text-sm text-slateblue-600">{importState.message}</span>
            <div className="w-64 h-1.5 bg-slateblue-100 rounded-full overflow-hidden">
              <div className="h-full bg-phoebe-500 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {importState.status === 'success' && (
          <div className="flex items-center gap-3 text-emerald-600 animate-scale-in">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">{importState.message}</span>
          </div>
        )}

        {importState.status === 'error' && (
          <div className="flex items-start gap-3 text-red-500 animate-scale-in max-w-md">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-1">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-sm">{importState.message}</span>
          </div>
        )}
      </div>

      {/* 模型卡片网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {modelConfig.models.map((model) => {
          const isActive = model.name === modelConfig.activeModel ||
                           (modelConfig.activeModel === model.path)
          return (
            <div key={model.name} className={`model-card p-5 ${isActive ? 'active' : ''}`}>
              {/* 缩略图 */}
              <div className="w-full aspect-square bg-gradient-to-br from-ivory-100 to-slateblue-50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                {model.thumbnail ? (
                  <img src={model.thumbnail} alt={model.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Box className="w-10 h-10 text-slateblue-300 mx-auto mb-2" />
                    <span className="text-[10px] text-slateblue-300">Live2D {model.model3Json}</span>
                  </div>
                )}
              </div>

              {/* 模型信息 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slateblue-800 truncate">{model.name}</h3>
                  {isActive && (
                    <span className="tag bg-phoebe-100 text-phoebe-700 flex items-center gap-1 flex-shrink-0">
                      <Star className="w-3 h-3" /> 当前角色
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slateblue-400 font-mono truncate">{model.model3Json}</p>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setPreviewModel(model)}
                    className="flex-1 btn-ghost text-xs py-1.5 flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> 预览
                  </button>
                  {!isActive ? (
                    <button
                      onClick={() => handleSetActive(model.name)}
                      className="flex-1 btn-primary text-xs py-1.5"
                    >
                      设为当前
                    </button>
                  ) : (
                    <button className="flex-1 bg-emerald-50 text-emerald-700 text-xs py-1.5 rounded-lg font-medium cursor-default flex items-center justify-center gap-1">
                      <Check className="w-3 h-3" /> 使用中
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(model.name)}
                    disabled={isActive}
                    className="p-1.5 text-slateblue-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={isActive ? '当前使用的模型不能删除' : '删除模型'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 模型预览弹窗 */}
      {previewModel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewModel(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[500px] p-6 space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slateblue-900">预览: {previewModel.name}</h3>
              <button
                onClick={() => setPreviewModel(null)}
                className="p-1.5 text-slateblue-400 hover:text-slateblue-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full aspect-square bg-gradient-to-br from-ivory-50 to-slateblue-50 rounded-xl flex items-center justify-center">
              <div className="text-center space-y-3">
                <Box className="w-16 h-16 text-slateblue-200 mx-auto" />
                <div>
                  <p className="text-sm text-slateblue-400 font-mono">{previewModel.model3Json}</p>
                  <p className="text-[10px] text-slateblue-300 mt-1">PixiJS 预览将在后续接入</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slateblue-400">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Cubism 4
              </span>
              <span className="flex items-center gap-1">
                <FileWarning className="w-3 h-3" /> 路径: ~/.deskpet/models/{previewModel.path}/
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
