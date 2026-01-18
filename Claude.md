# Bug 修复流程指南

## 原则

1. **先分析，后动手** - 理解问题再修复
2. **小步快跑** - 每次只修复一个问题
3. **充分测试** - 推送到 Vercel 验证

## 排查流程

### 第一步：理解问题

1. 访问 Vercel 部署的线上环境复现问题
2. 查看是否有错误提示
3. 理解期望行为 vs 实际行为

### 第二步：定位代码位置

```bash
# 搜索相关代码
grep -rn "关键词" src/

# 或者查看 Git 历史找相关改动
git log --oneline --all | head -20
```

### 第三步：添加调试输出

在可疑位置添加 `console.log`，并将关键数据包含在 API 响应中返回：

```typescript
// 例如在 API 响应中添加 debug 信息
const debugInfo: Record<string, unknown> = {
  codeMarker: 'UNIQUE_MARKER',  // 验证代码已更新
  entries: entries.map(e => ({
    content: e.content,
    duration: e.duration,
  })),
};
return response.status(200).json({ stats, debug: debugInfo });
```

### 第四步：推送验证

```bash
git add .
git commit -m "描述修复内容"
git push
```

等待 Vercel 部署完成后测试。

### 第五步：观察数据

```bash
# 测试 API 并查看调试信息
curl -X POST "https://roam-timeline.vercel.app/api/roam/timeline-stats" \
  -H "Content-Type: application/json" \
  -d '{"graphName":"你的图名","startDate":"xxx","endDate":"xxx"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
# 打印关键调试信息
"
```

## 常见问题模式

### API 返回数据不对

1. 检查 `timelineData` 原始数据格式
2. 检查 regex 是否匹配实际格式
3. 检查数据解析逻辑

### 前端显示问题

1. 检查数据是否正确传递到组件
2. 检查渲染逻辑
3. 检查状态管理

### 数据源搞混

确保根据 `type` 正确选择数据源：

```typescript
// 错误：总是用 categories
items = categories.map(...)

// 正确：根据 type 选择
items = (type === 'tag' ? categories : pages).map(...)
```

## 调试技巧

1. **添加唯一标记** - 确保代码已更新部署
2. **返回完整数据** - 在 API 响应中包含原始数据
3. **分步骤打印** - 每一步都打印中间结果
4. **本地测试 regex** - 先用 Node.js 测试正则表达式

## 提交流式

```bash
git add <修改的文件>
git commit -m "$(cat <<'EOF'
修复: 简要描述问题

详细说明修复内容

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
EOF
)"
git push
```

## 验证清单

- [ ] 代码已推送并部署
- [ ] 线上环境复现问题
- [ ] 修复后问题消失
- [ ] 调试代码已移除（或保留必要的）
- [ ] 没有引入新问题
