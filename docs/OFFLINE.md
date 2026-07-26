# 离线与本地数据

## IndexedDB

客户端使用 Dexie 管理 `stories`、`storyRuns`、`journalEntries`、`localPhotos`、`draftPreferences`、`syncQueue` 和 `settings`。数据库包含显式 v1→v2 迁移；无法通过共享 Schema 校验的记录会移入 `corruptRecords`，不会阻止应用启动。

故事记录按 `updatedAt` 只保留最近 5 条，删除故事时会级联删除运行状态、手记与本地照片。大型故事 JSON、路线、POI 和照片不写入 Local Storage 或 Session Storage。

## 照片

照片在客户端压缩为 JPEG 或 WebP，质量约 0.75，最长边不超过 1280px，保存产物不超过 2MB。照片只存放在当前设备的 IndexedDB，不上传 CloudBase。

## PWA 缓存边界

Service Worker 预缓存应用外壳、CSS、JavaScript 和本地图标。当前故事 JSON、POI 基础信息及抽象路线由 IndexedDB 提供离线读取。

不缓存 `/v1` API 响应、敏感日志、反馈请求、腾讯地图瓦片或任何服务端密钥。

## 同步队列

反馈、匿名事件和故事完成状态可以写入 `syncQueue`。浏览器恢复联网时自动处理到期记录；失败采用指数退避，最多尝试 3 次。达到上限的记录会保留错误信息，避免无限重试。
