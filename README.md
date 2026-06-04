# 🐾 DeskPet — AI 桌面宠物

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

**一个基于 Deepseek API 的智能桌面宠物。可爱、陪伴、能聊天。**

</div>

---

## ✨ 功能

| 功能 | 描述 |
|------|------|
| 🖥️ **桌面陪伴** | 萌宠常驻桌面，可自由拖拽走动，贴边自动隐藏 |
| 🗣️ **AI 对话** | 连接 Deepseek API，随时聊天、提问、倾诉 |
| 🎨 **可爱动画** | 待机、拖拽、说话、睡觉等多套动画状态 |
| 🔧 **可配置** | 自定义 API Key、模型参数、宠物外观、语言风格 |
| 💾 **本地记忆** | 宠物会记住你们的对话，越聊越有默契 |
| 🪟 **轻量透明窗口** | 不遮挡工作区，始终悬浮在桌面一层 |

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- 一个 [Deepseek API Key](https://platform.deepseek.com/)

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourname/deskpet.git
cd deskpet

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

### 配置 API

首次启动时会自动弹出设置面板。你也可以在项目根目录创建 `.env` 文件：

```env
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-chat       # 可选：deepseek-chat / deepseek-reasoner
DEEPSEEK_TEMPERATURE=0.7           # 可选项，0.0 ~ 2.0
```

## 🧱 技术栈

| 层 | 技术选型 |
|----|----------|
| 🏗️ **框架** | [Electron](https://www.electronjs.org/) 30+ |
| ⚛️ **前端** | [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) |
| 🎬 **动画** | CSS Animations + [Lottie-web](https://airbnb.io/lottie/) / Canvas 2D |
| 💬 **API** | Deepseek Chat API（支持 SSE 流式输出） |
| 🎨 **样式** | [Tailwind CSS](https://tailwindcss.com/) |
| 📦 **打包** | [electron-builder](https://www.electron.build/) |

## 📁 项目结构

```
deskpet/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             #   入口：窗口创建、托盘
│   │   ├── ipc.ts               #   IPC 通信处理
│   │   └── tray.ts              #   系统托盘菜单
│   ├── preload/                 # 预加载脚本
│   │   └── index.ts
│   ├── renderer/                # 渲染进程（UI）
│   │   ├── App.tsx              #   根组件
│   │   ├── components/          #   组件
│   │   │   ├── Pet.tsx          #     宠物主体（动画切换）
│   │   │   ├── PetSprite.tsx    #     宠物精灵渲染
│   │   │   ├── Bubble.tsx       #     对话气泡
│   │   │   ├── Settings.tsx     #     设置面板
│   │   │   └── Taskbar.tsx      #     底边工具栏
│   │   ├── hooks/               #   自定义 Hooks
│   │   │   ├── usePetState.ts   #     宠物状态管理
│   │   │   ├── useDrag.ts       #     拖拽逻辑
│   │   │   └── useAutoMove.ts   #     自动走动逻辑
│   │   ├── api/                 #   API 封装
│   │   │   └── deepseek.ts      #     Deepseek 客户端
│   │   ├── stores/              #   状态管理
│   │   │   └── petStore.ts      #     全局宠物状态
│   │   └── assets/              #   静态资源
│   │       ├── sprites/         #     宠物精灵帧
│   │       └── animations/      #     Lottie 动画 JSON
│   └── shared/                  # 主进程与渲染进程共享类型
│       └── types.ts
├── public/                      # 静态资源（图标等）
│   └── icon.png
├── .env.example                 # 环境变量示例
├── .gitignore
├── electron-builder.yml         # 打包配置
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🎯 开发路线

### 第一阶段：基础框架 ✅
- [x] 项目脚手架与透明窗口
- [ ] 宠物角色设计与基础动画
- [ ] 拖拽、贴边、随机走动

### 第二阶段：AI 集成
- [ ] Deepseek API 封装（流式/非流式）
- [ ] 对话气泡组件
- [ ] 按快捷键 / 点击触发对话

### 第三阶段：交互升级
- [ ] 右键菜单与设置面板
- [ ] 状态系统（心情、疲劳度）
- [ ] 定时主动搭话 / 提醒

### 第四阶段：打磨发布
- [ ] 多套宠物皮肤
- [ ] 记忆持久化（本地 JSON / SQLite）
- [ ] 跨平台打包与自动更新

## 🤝 贡献指南

欢迎任何形式的贡献！在提交 PR 之前：

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的改动 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

请确保代码通过 ESLint 检查且能正常构建。

## 📄 许可证

[MIT](./LICENSE)

---

<div align="center">
  <sub>用 ❤️ 和 ☕ 制作</sub>
</div>
