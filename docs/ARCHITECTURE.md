# 系统架构

## 工作区

- `apps/web`：React、Vite、TypeScript PWA。
- `cloudfunctions/citywalk-api`：CloudBase HTTP 云函数。
- `packages/shared`：前后端共享 Zod Schema 与类型。
- `content`：人工维护的 POI、路线包和内容模板。
- `database-schemas`：数据库结构与迁移资料。

## 边界

浏览器只访问自有 HTTP API 和腾讯地图能力。AI 服务及所有服务端密钥均位于云函数侧。前后端交换数据必须通过共享 Zod Schema 校验。
