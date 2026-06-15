---
name: "context-more"
description: "Clarifies ambiguous requirements and gathers missing context. Invoke immediately when user requests lack technical details, have ambiguity, or require architectural/design decisions before coding."
---

# 需求澄清与上下文收集 (Context More)

## 核心目标
在明确了用户的核心需求（如：开发复杂功能、编写代码、UI 优化、性能优化等）之后，在开始实际执行前，强制 Agent 停下来。基于完成该需求所需的步骤，规划出需要哪些详细的上下文方向，然后通过结构化提问与用户沟通，获取这些缺失的上下文，从而消除歧义，避免盲目猜测和过度工程。

## 触发场景与边界情况 (Edge Cases)
当用户的核心意图已明确，但在具体执行层面遇到以下情况时，必须触发此工作流：
- **一句话需求**：如“加个登录页面”、“优化一下性能”、“修复那个 bug”，意图明确但缺乏执行细节。
- **技术栈缺失**：未指明使用的 UI 组件库、状态管理、数据请求库等。
- **UI/UX 缺失**：未说明加载状态 (Loading)、空状态 (Empty)、错误提示 (Error)、响应式适配 (Mobile/PC)。
- **业务边界模糊**：未说明表单校验规则、极端数据情况、权限控制等。

## 工作流 (Workflow)

### 阶段一：环境自检 (Auto-Context Gathering)
在向用户提问之前，Agent 必须先尝试自己寻找答案，减少无效提问。

### 阶段二：结果导向的案例收集与推演 (Result-Oriented Case Gathering & Planning)
基于用户的核心需求和阶段一的扫描结果，采用**结果导向（Start with the End in Mind）**的思维方式。在内心（思考过程中）必须先构建出以下结构化的推演模型（JSON 格式），然后再进行下一步。

#### 推演模型结构 (JSON Schema)
```json
{
  "core_intent": "用户的核心需求",
  "background": "当前项目的背景描述与已知上下文",
  "user_intent_reasoning": "深度推导用户的真实意图（为什么要做这个？痛点是什么？）",
  "core_reasoning": "需求实施的整体逻辑推导",
  "best_practices": ["业界标准的最佳实践或参考案例"],
  "core_items": [
    {
      "position": "具体定位的内容模块",
      "current_status": "当前状态描述",
      "expect_target": "期望达到的最终目标与效果",
      "gap_analysis": [
        { "key": "分析维度(如 architecture/ui_interaction)", "analysis": "具体的缺口分析" }
      ],
      "more_practices": ["针对该具体模块的细分案例或实践"]
    }
  ],
  "questions_to_ask": ["基于 core_items 提取出的 3-4 个核心问题"]
}
```

#### Few-Shot Examples (推演示例)

**Example 1: UI 优化需求**
*用户输入：“帮我优化一下首页的列表，现在太丑了。”*
```json
{
  "core_intent": "优化首页列表 UI",
  "background": "项目使用 React + TailwindCSS，当前列表是简单的 table 布局",
  "user_intent_reasoning": "用户觉得当前列表视觉单调，可能缺乏层级感、图片展示不佳或信息密度不合理，期望提升产品的现代感和用户体验。",
  "core_reasoning": "需要将传统的 table 布局升级为更具视觉冲击力的卡片式或瀑布流布局，并增加交互动效。",
  "best_practices": ["小红书的瀑布流布局", "Twitter 的卡片式信息流", "Framer Motion 列表动画"],
  "core_items": [
    {
      "position": "首页主内容区列表",
      "current_status": "使用原生 table 标签，无图片预览，文字拥挤，无 hover 动效",
      "expect_target": "图文并茂、层次分明、具有现代感的响应式列表",
      "gap_analysis": [
        { "key": "ui_interaction", "analysis": "是采用等高卡片网格（Grid）还是错落有致的瀑布流（Masonry）？是否需要图片懒加载？" },
        { "key": "data_flow", "analysis": "当前 API 返回的数据是否包含高质量的封面图？如果没有，UI 优化将受限。" }
      ],
      "more_practices": ["Pinterest 的 Masonry 布局", "Ant Design 的 Card 组件"]
    }
  ],
  "questions_to_ask": [
    "关于列表的整体视觉风格，您更倾向于哪种展示方式？（选项：小红书式瀑布流 / Twitter式标准卡片）",
    "当前数据源是否包含可供展示的封面图片？"
  ]
}
```

**Example 2: 性能优化需求**
*用户输入：“搜索接口太慢了，用户经常抱怨卡顿。”*
```json
{
  "core_intent": "优化搜索接口性能与前端体验",
  "background": "前端使用 React，后端 API 响应时间 > 2s，用户输入时会频繁触发请求",
  "user_intent_reasoning": "用户痛点是搜索反馈迟钝，导致流失。意图是通过前端防抖、缓存或后端优化来降低延迟感。",
  "core_reasoning": "前端需要实现防抖（Debounce）和本地缓存，同时增加骨架屏（Skeleton）缓解等待焦虑；后端可能需要增加索引或 Redis 缓存。",
  "best_practices": ["Google 搜索的即时反馈与防抖策略", "SWR / React Query 的本地缓存机制", "骨架屏加载状态"],
  "core_items": [
    {
      "position": "顶部全局搜索框及下拉结果面板",
      "current_status": "每次按键都会发请求，无防抖；等待期间只有简单的 Spinner，体验差",
      "expect_target": "输入流畅无卡顿，请求频率合理，等待期间有平滑的视觉过渡",
      "gap_analysis": [
        { "key": "architecture", "analysis": "前端是否已经引入了 SWR 或 React Query 等请求库？如果没有，是否允许引入？" },
        { "key": "ui_interaction", "analysis": "等待期间是使用骨架屏（Skeleton）还是保留上一次的搜索结果并加半透明遮罩？" }
      ],
      "more_practices": ["Algolia 的即时搜索体验", "React Query 的 keepPreviousData 模式"]
    }
  ],
  "questions_to_ask": [
    "为了优化等待体验，您倾向于哪种加载状态展示？（选项：骨架屏占位 / 保留旧数据加透明遮罩）",
    "是否允许引入 React Query 或 SWR 来接管搜索请求的缓存和防抖逻辑？"
  ]
}
```
*注意：以上 JSON 模型仅用于 Agent 的内部思考与逻辑推演，不需要输出给用户。*

### 阶段三：高置信度结构化提问 (High-Confidence Structured Questioning)
**核心原则：绝不假设 (Never Assume)**。AI 模型天生倾向于猜测，但你必须克制这种倾向。在对需求达到 **95% 的执行置信度**之前，绝对不要开始编写代码。

将阶段二 `questions_to_ask` 中的缺口转化为 3-4 个高价值的核心问题。

**环境 A：在 Trae IDE 环境中（支持工具调用）**
必须调用 `AskUserQuestion` 工具。你的提问必须符合以下专业规范：
1. **控制数量**：每次最多提 3-4 个问题，优先解决架构和核心业务逻辑的阻塞点。
2. **MECE 原则**：提供的 2-4 个选项必须是“相互独立、完全穷尽”的（Mutually Exclusive, Collectively Exhaustive）。
3. **具象化描述 (Crucial)**：在 `description` 中，**必须引入具体的业界案例或视觉/逻辑效果描述**，帮助用户具象化理解。
   - *反面教材*：`label`: "方案 A", `description`: "使用 Zustand 进行状态管理。"（太干瘪）
   - *优秀范例*：`label`: "卡片式瀑布流", `description`: "类似小红书的展示方式，适合图片为主的内容，视觉冲击力强。"
4. **推荐机制**：在最符合当前项目技术栈或行业最佳实践的选项后标注 `(Recommended)`。
5. **兜底选项**：工具会自动提供 "Other" 选项，你不需要手动添加，但要准备好处理用户的自定义输入。

**环境 B：普通对话环境（降级方案）**
在 Markdown 中以清晰的列表形式提问，同样遵循上述的具象化与 MECE 原则：
> **问题 1：关于 [UI 风格/架构方案]，您期望达到哪种效果？**
> - **[A] 方案 A (推荐)**：[具体案例，如：类似 Google 的极简风格] - [优点与适用场景]
> - **[B] 方案 B**：[具体案例，如：类似 Notion 的侧边栏风格] - [优点与适用场景]
> - **[C] 其他**：请补充您的想法。

### 阶段四：方案收敛与确认 (Plan Generation) - ⚠️ CRITICAL STEP
**警告：无论用户在阶段三中回答了什么，你都绝对不能直接开始写代码！你必须严格执行本阶段。**

1. **合并上下文**：接收到用户的答复后，将新获取的信息与阶段二的推演模型合并。
2. **输出实施方案**：向用户输出一份结构化的**实施方案清单 (Implementation Plan)**，必须按优先级 (P0-P4) 排序。
3. **强制阻断 (Hard Stop)**：在输出方案后，你必须明确询问用户：“**以上方案是否符合您的预期？是否可以开始编写代码？**”
4. **等待授权**：只有在用户明确回复“同意”、“可以”、“没问题”等授权指令后，你才能调用 `Write` 或 `Edit` 工具修改代码。如果用户提出修改意见，必须重新调整方案并再次等待确认。

## 行为准则 (Rules)
- **禁止开放式提问**：永远不要问“请提供更多细节”，必须给出具体的选项。
- **禁止过度假设**：如果 `package.json` 中没有路由库，不要假设用户想用 `react-router`，必须提问。
- **一步一问**：如果缺失的信息太多（超过 3 个核心问题），优先询问最核心的架构/业务问题，次要的 UI 细节可以在后续开发中再问。