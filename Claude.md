# 开发规范

## 开发流程

1. **开发完成后**，先运行 `npm run build` 确保没有编译错误
2. **启动顺序**：
   - 先启动后端服务：`node server.mjs`（端口 3000）
   - 再启动前端开发服务器：`npm run dev`（端口 5173/5174）
3. **测试入口**：打开 http://localhost:5174 测试功能
4. **查看请求日志**：后端服务会在终端打印所有 API 请求

## 测试要点

- 确保同一天的 Timeline 块不会重复创建
- 确保开始时间正确读取今天/昨天的最后一条记录
- 测试 # 标签选择和 @ 页面引用功能
- 测试图片上传和格式化工具栏
- 查看终端日志确认 API 请求正确发送

## 代码规范

- 使用 TypeScript，严格类型检查
- 组件使用 React hooks
- API 调用使用 useCallback 包装
- 避免在 localStorage 中存储敏感信息

## Roam API 注意事项

- Timeline 块使用日期 UID（`timeline-YYYY-MM-DD`）确保唯一性
- 查询时按 UID 精确匹配，而不是按字符串匹配
- 创建块之前先检查是否已存在
