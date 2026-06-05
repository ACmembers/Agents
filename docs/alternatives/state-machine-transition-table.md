# 状态机显式迁移白名单表

**状态**：备选（未采用）
**决策时间**：阶段 2 开始前重新评估
**主方案**：优先级数字比较（happy=6 > sad=4 → 高优覆盖低优）
**切换成本**：低 — 仅需修改 `StateResolver::resolve()` 和 manifest schema

## 方案描述

将 `StateResolver` 从"优先级数字比大小"改为"显式迁移白名单表"。每个 DisplayState 维护一个允许跳转到哪些状态的集合。角色包 `manifest.json` 可自定义迁移规则。

```json
"state_transitions": {
  "sleeping": ["greeting", "idle"],
  "sad":      ["greeting", "happy", "idle", "sleeping"],
  "*":        ["idle", "greeting", "thinking", "happy", "sad", "surprised", "listening", "sleeping"]
}
```

`*` 作为默认规则。角色包不提供此字段时回退到优先级模式。

## 对比

| | 主方案（优先级） | 此方案（迁移表） |
|---|---|---|
| 优点 | 简单，代码量少 | 更灵活，符合"资源表驱动"设计原则 |
| 缺点 | sleeping→happy 这种跳变合理吗？不够精细 | manifest 复杂度增加；迁移规则维护成本 |

## 迁移路径

1. manifest schema 新增 `state_transitions` 可选字段
2. `StateResolver` 新增 `transition_map: HashMap<DisplayState, HashSet<DisplayState>>`
3. `resolve()` 中：先检查迁移表，若表中有规则则用表；否则回退到优先级
4. `RolePackLoader` 解析 `state_transitions` 并注入 `StateResolver`
