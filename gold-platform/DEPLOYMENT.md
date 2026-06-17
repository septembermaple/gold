# 部署文档

## 项目概述

本项目是一个黄金价格分析平台，包含前端和后端两个部分：
- **前端**: React + TypeScript + Vite
- **后端**: Hono (Cloudflare Workers)

## 环境要求

- Node.js >= 20.x
- npm >= 10.x
- Cloudflare Wrangler CLI >= 4.x

## 前置准备

### 1. 安装依赖

```bash
# 前端依赖
cd gold-platform/frontend
npm install

# 后端依赖
cd gold-platform/backend
npm install
```

### 2. 配置环境变量

#### 前端
编辑 `frontend/.env.production`:
```env
VITE_API_BASE_URL=https://api.aumind.cc/api
```

#### 后端
编辑 `backend/wrangler.toml`:
```toml
name = "gold-platform-api"
main = "src/index.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[triggers]
crons = ["*/30 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "gold-platform-db"
database_id = "aa31a64d-22ef-4ce9-b239-56eb78763cca"

[vars]
JWT_SECRET = "your-jwt-secret"
FRED_API_KEY = "your-fred-api-key"
```

## 部署流程

### 前端部署

```bash
# 进入前端目录
cd gold-platform/frontend

# 构建项目
npm run build

# 部署到 Cloudflare Pages (production 分支)
npx wrangler pages deploy dist --project-name=gold-platform --branch=production
```

### 后端部署

```bash
# 进入后端目录
cd gold-platform/backend

# 部署到 Cloudflare Workers
npx wrangler deploy
```

## 部署环境说明

| 环境 | 分支 | 域名 | 用途 |
|------|------|------|------|
| Production | production | aumind.cc | 生产环境 |
| Preview | main | *.pages.dev | 预览环境 |

## 常用命令

```bash
# 前端开发服务器
cd frontend && npm run dev

# 前端构建
cd frontend && npm run build

# 前端预览构建结果
cd frontend && npm run preview

# 部署前端到生产环境
cd frontend && npx wrangler pages deploy dist --project-name=gold-platform --branch=production

# 部署前端到预览环境
cd frontend && npx wrangler pages deploy dist --project-name=gold-platform

# 后端开发
cd backend && npx wrangler dev

# 后端部署
cd backend && npx wrangler deploy
```

## CI/CD 说明

当前项目使用 Cloudflare Pages 的 Git 集成进行自动部署：
1. 推送代码到 GitHub `main` 分支会触发预览环境部署
2. 推送代码到 GitHub `production` 分支会触发生产环境部署

## 常见问题

### 1. PowerShell 执行策略问题

**问题**: `npm : File cannot be loaded because running scripts is disabled`

**解决方案**:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### 2. TypeScript 编译错误

**问题**: `Cannot find module or type declarations for side-effect import of './index.css'`

**解决方案**:
确保存在 `src/index.css.d.ts` 文件：
```typescript
declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}
```

### 3. Wrangler 命令未找到

**问题**: `wrangler : The term 'wrangler' is not recognized`

**解决方案**:
```bash
npx wrangler <command>
```

### 4. 部署后页面无变化

**原因**: 
- 构建产物 `dist` 目录未更新
- Cloudflare 缓存未刷新

**解决方案**:
```bash
# 重新构建
npm run build

# 重新部署
npx wrangler pages deploy dist --project-name=gold-platform --branch=production

# 浏览器强制刷新 (Ctrl + Shift + R)
```

## 项目结构

```
gold-platform/
├── frontend/           # 前端应用
│   ├── src/           # 源代码
│   ├── dist/          # 构建产物 (不进Git)
│   ├── wrangler.toml  # Pages 配置
│   └── package.json
├── backend/           # 后端 API
│   ├── src/           # 源代码
│   ├── wrangler.toml  # Workers 配置
│   └── package.json
└── DEPLOYMENT.md      # 本文件
```
