# CityWalk Story MVP 工程规则

- 产品是面向移动端的 CityWalk 互动剧情生成器，主要设计宽度为 360px 至 430px。
- 前端是 React + Vite + TypeScript PWA。
- 后端运行于 CloudBase HTTP 云函数。
- AI 能力只允许在服务端调用；客户端不得直接调用任何 AI 服务。
- 地图使用腾讯地图。
- 不使用 Google、Mapbox、OpenAI、海外 CDN 或远程字体。
- 正式 POI 必须来自人工策展和可核验的数据源，不得由 AI 编造。
- 当前 MVP 以固定 Mock POI 开发：ID 必须以 `mock_` 开头，`verificationStatus` 必须为 `mock`。
- `APP_CONTENT_MODE=mock` 只加载 Mock POI；`APP_CONTENT_MODE=verified` 只加载已核验 POI，数量不足必须报错且不得回退 Mock。
- 路线引擎、Story Graph、地图适配、状态机、离线存储和 CloudBase API 只能依赖共享 POI Schema 与 ID，不得依赖具体地点名称。
- Mock POI 仅用于本地开发、自动化测试和功能演示，不得用于真实线下导航。
- 所有前后端交换的数据必须使用 `packages/shared` 中的共享 Zod Schema 校验。
- 不允许使用 `dangerouslySetInnerHTML`。
- 服务端密钥不得放入任何 `VITE_` 环境变量。
- 每个开发阶段结束必须运行 `npm run check` 并修复全部错误。
- 不允许与当前阶段目标无关的重构。
