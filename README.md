# 城市暗线｜CityWalk 互动剧情生成器 MVP 1.0

移动端 CityWalk 互动剧情生成器，前端为 React + Vite PWA，后端目标环境为 CloudBase HTTP 云函数。

## 当前内容策略

项目当前只使用固定 Mock POI 进行本地开发、自动化测试和功能演示：

- Mock POI 的 ID 统一以 `mock_` 开头。
- `verificationStatus` 统一为 `mock`。
- Mock 数据不代表真实地点已经核验，也不具备正式上线条件。
- Mock 坐标只用于稳定开发流程，不得用于真实线下导航。

通过服务端环境变量选择内容模式：

```dotenv
APP_CONTENT_MODE=mock
```

- `mock`：只加载 `verificationStatus: mock` 的 POI。
- `verified`：只加载 `verificationStatus: verified` 的 POI；数量不足时明确报错，绝不回退到 Mock 数据。

路线引擎、Story Graph、地图适配层、状态机、离线存储和 CloudBase API 必须只依赖共享 POI Schema 与 ID，不得依赖具体地点名称。

## 常用命令

```bash
npm run dev
npm run dev:api
npm run content:validate
npm run check
```

`npm run dev:api` 默认在 `http://localhost:3000` 启动本地 Express API，可通过 `GET /health` 检查运行状态。环境变量从本机运行环境注入，参考 `.env.example`；服务端密钥不得使用 `VITE_` 前缀。

## 正式发布前

正式发布前必须完成真实 POI 人工核验、腾讯地图路线联调和至少一次完整实地走测。完整清单见 [`docs/RELEASE_BLOCKERS.md`](docs/RELEASE_BLOCKERS.md)。
