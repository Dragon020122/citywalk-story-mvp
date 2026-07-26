# CloudBase 数据库模型

本目录中的 JSON Schema 描述 `citywalk-api` 服务端使用的五个集合。每份模型都声明：

```json
{
  "clientPermissions": {
    "read": false,
    "write": false
  }
}
```

前端不得直连这些集合；所有读写均由 CloudBase HTTP 云函数通过 `@cloudbase/node-sdk` 完成。部署集合和索引前应在目标环境复核 Schema。
