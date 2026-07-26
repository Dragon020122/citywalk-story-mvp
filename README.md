# 城市暗线：CityWalk 互动剧情生成器 MVP 1.0

## 产品定位

城市暗线是一款面向 360–430px 移动设备的 CityWalk 互动剧情 PWA。用户选择路线与偏好后，服务端基于人工策展 POI 生成可执行 Story Graph；前端负责路线预览、现场任务、分支选择、离线恢复、确定性结局、分享海报和匿名反馈。

当前仓库是 MVP 工程基线。Mock POI 只用于本地开发、自动化测试和演示，不得用于真实线下导航。

## MVP 功能

- 八步故事创建与草稿恢复
- 路线规划、故事生成、预览与腾讯地图导航
- 观察、拍照、解谜、声音、笔记和同行任务
- Story Graph 状态机、线索背包、支线与分支选择
- 地点跳过、仅从策展候选中重规划
- IndexedDB 离线存储、断网继续与恢复同步
- 确定性结局计算、结算摘要和两种尺寸的本地分享海报
- 隐私默认关闭的照片、笔记、地点海报开关
- 匿名反馈离线入队和四种重新开始方式

## 技术架构

- 前端：React 19、Vite、TypeScript、React Router、XState、Dexie、TanStack Query、PWA
- 后端：Express 5 打包为 CloudBase HTTP 云函数
- 共享领域层：`packages/shared` 中的 Zod Schema、路线引擎、Story Graph 与结局计算
- 地图：腾讯位置服务；首屏不加载地图，地图组件按需加载
- AI：只允许 CloudBase AI 在服务端调用；客户端没有 AI 密钥或 AI SDK
- 数据：POI 和前后端载荷均经过共享 Zod Schema 校验

请求关系：

```text
移动端 PWA → CloudBase HTTP API → 路线引擎 / CloudBase AI / 腾讯地图 WebService
      ↓                 ↓
 IndexedDB 本地档案   CloudBase 数据库（Live 模式）
```

## 目录结构

```text
apps/web/                       React + Vite PWA
cloudfunctions/citywalk-api/    CloudBase HTTP 云函数
packages/shared/                共享 Schema 与领域逻辑
content/                        POI CSV、路线包与生成结果
scripts/                        内容导入与发布安全审查
database-schemas/               CloudBase 集合说明
docs/                           架构、策展、部署与验收文档
.github/workflows/ci.yml        持续集成
```

## 本地开发

要求 Node.js 20+、npm 10+；CI 使用 Node.js 22。

```bash
npm ci
copy .env.example .env
npm run content:validate
npm run dev
```

前端默认运行于 `http://localhost:5173`，本地 API 默认运行于 `http://localhost:3000`。`GET /health` 可用于健康检查。

## 内容导入

POI CSV 以 `content/pois/poi-template.csv` 为模板。Mock 数据使用：

```bash
npm run content:validate
```

该命令校验 `content/pois/mock-pois.csv` 并更新 `content/generated/pois.json` 与报告。正式 POI 必须由人工策展，保留可核验来源；规则详见 [POI 策展说明](docs/POI_CURATION.md)。

## 环境变量

以 [.env.example](.env.example) 为唯一模板。真实 `.env` 被 Git 忽略。

| 变量 | 作用 | 可进入浏览器 |
| --- | --- | --- |
| `APP_CONTENT_MODE` | `mock` 或 `verified` | 否 |
| `CLOUDBASE_ENV_ID` | CloudBase 环境 | 否 |
| `AI_MODEL` | CloudBase AI 模型名 | 否 |
| `TENCENT_MAP_SERVER_KEY` | 腾讯地图 WebService Key | 否 |
| `VITE_TENCENT_MAP_BROWSER_KEY` | 腾讯地图 JS API GL 浏览器 Key | 是 |
| `VITE_TENCENT_MAP_NAV_BASE_URL` | 腾讯地图导航地址 | 是 |
| `ALLOWED_ORIGINS` | CORS 允许来源，逗号分隔 | 否 |
| `JSON_BODY_LIMIT` | JSON 请求体上限，默认 `64kb` | 否 |
| `RATE_LIMIT_*` | 生成、重生成和普通接口限流 | 否 |

任何服务端密钥都不得添加 `VITE_` 前缀。

## Mock 模式与 Live 模式

`APP_CONTENT_MODE=mock` 只加载 ID 以 `mock_` 开头且 `verificationStatus=mock` 的固定 POI。

`APP_CONTENT_MODE=verified` 是 Live 内容入口，只加载已核验 POI；数量不足会明确报错，不会回退到 Mock。正式发布前仍需完成真实 POI 导入、腾讯地图联调和实地走测。

## CloudBase AI

故事生成分为 Blueprint 和 Story Graph 两段，带超时、有限修复和 Mock 回退。所有 AI 原始输出先经 JSON 解析和共享 Zod Schema 校验，校验失败不得直接进入客户端。客户端不得直接调用任何 AI 服务。

## 腾讯地图

- 浏览器端只使用腾讯地图 JS API GL 与腾讯地图 URI 导航。
- 服务端路线距离使用腾讯地图 WebService。
- 地图代码按需加载，首页和首屏不请求腾讯地图。
- 除腾讯地图外没有运行时外部资源，字体、图标和静态资源均本地打包。

## 测试

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:coverage
npm run build
npm run release:audit
npm run test:e2e
```

覆盖率门禁：共享领域模型 90%、路线引擎 90%、Story Graph 解释器 90%、API 关键服务 80%、前端关键逻辑 80%。Playwright 覆盖 iPhone SE、iPhone 13、Pixel 7 和 390×844。

完整阶段检查：

```bash
npm run check
```

## GitHub

[GitHub Actions 工作流](.github/workflows/ci.yml) 在 `push` 和 `pull_request` 上执行依赖锁定安装、内容校验、lint、类型检查、单元测试、覆盖率门禁、构建和发布审查。端到端测试依赖 Playwright 浏览器，建议在部署预览或具备浏览器缓存的专用任务中运行。

## CloudBase 部署

1. 在 CloudBase 创建环境、HTTP 云函数和所需数据库集合。
2. 按 [数据库 Schema](database-schemas/README.md) 建立集合与索引。
3. 在云函数环境中配置服务端变量，不上传本地 `.env`。
4. 执行 `npm run build`，部署 `cloudfunctions/citywalk-api/dist`。
5. 部署 `apps/web/dist` 到国内可访问的静态托管，并把域名加入 `ALLOWED_ORIGINS`。
6. 验证 `/health`、限流、CORS、生成回退与错误脱敏。

详细步骤与回滚要求见 [部署说明](docs/DEPLOYMENT.md)。

## 隐私

- 不收集姓名、手机号或精确实时位置。
- 原始 IP 不入库，只用于生成匿名哈希客户端标识。
- 用户照片压缩后只保存在当前设备的 IndexedDB，不进入 API 或同步队列。
- 海报默认不包含照片、笔记和经过地点；用户必须逐项主动开启。
- 反馈为匿名数据，可离线入队，恢复网络后提交。

## 安全

- Helmet、显式 CORS、请求体限制、分级限流和统一无 stack 错误响应
- 所有 API 输入和输出使用 `packages/shared` Zod Schema
- AI 输出在服务端校验
- 禁止 `dangerouslySetInnerHTML`、`eval` 和 Function 构造器
- Vite bundle 自动检查服务端 Key 标记
- 禁止真实 `.env`、海外 CDN、运行时 GitHub 资源和非腾讯地图外链

运行 `npm run release:audit` 可复核上述静态基线。

## 已知限制

- 仓库当前只有 Mock POI，不能用于真实导航。
- Live 模式仍依赖人工核验内容、CloudBase 资源、腾讯地图配额和实地走测。
- 离线模式不缓存腾讯地图瓦片，也不能离线生成新故事或在线重规划。
- 本地照片受浏览器存储配额与用户清理数据影响。
- 部分上游 npm 依赖仍有无可用非破坏性升级的安全公告，发布前需持续跟踪并结合实际暴露面评估。

## 版本路线

- `1.0`：固定策展路线、完整互动流程、离线、结算、海报与反馈
- `1.1`：首批 verified POI、真实路线走测、可观测性与发布运维
- `1.2`：更多路线包、内容运营工具、无障碍与弱网增强
- 后续：在隐私和人工核验边界内扩展个性化与城市内容

正式发布阻断项见 [RELEASE_BLOCKERS](docs/RELEASE_BLOCKERS.md)，验收清单见 [ACCEPTANCE](docs/ACCEPTANCE.md)。
