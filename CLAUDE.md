# KnowFlow AI 项目规则

> 版本:v0.2 | 最后更新:2026-09-09
> 本节规则 = AI 每次会话的硬约束,内容越少越有效。

## 项目背景

- **产品**:KnowFlow AI——企业 AI 知识助手,让企业用户更快、更准确、更可信地获取内部知识。
- **MVP 场景**:新员工入职知识获取(主);企业内部技术支持(辅,仅 persona 级体现)。
- **演示知识库**:虚构企业 NovaTech 的 Synthetic Demo Data——所有演示文档必须标注 `synthetic: true`,任何场合不得将其描述为真实企业数据或真实商业项目。
- **文档语言**:本项目全部文档使用中文。
- **工作流依据**:`D:\AI-Product-Workflow`(SOP/01–04 + QUICK-START)。严格按其 4 Phase × 18 Stage 执行,每个 Stage 结束须人拍板后才进入下一 Stage;模板"逐个用,不全建"。

## 全局验收锚点(所有后续验收的基准)

1. 最小评测集 7 类场景全部**实测**达标(阈值与达标线定义见 `memory-bank/ai-design.md` 与 `docs/evaluation-plan.md`;所有数值只来自评测 run JSON,**禁止虚构/预估**)。
2. 核心 demo 闭环 ≤ 5 分钟走通(口径:打开产品 → 上传一篇文档 → 提问 → 获得带引用回答 → 点开来源核对 → 演示一次拒答,全程计时 ≤ 5 分钟)。

## 隔离红线(违反即会话级错误)

- **禁止**读取 `D:\CareerOS-AI` 的任何内容(memory-bank、业务代码、`.env`、设计文档、用户数据)。
- **禁止**把 CareerOS-AI 的产品逻辑、实现细节、页面业务逻辑写入 KnowFlow 文档或代码;如需参考其技术方案,必须先经用户明确同意且仅限用户转述。
- `D:\AI-Product-Workflow` 为方法论与模板来源,**只读不改**。
- KnowFlow 的全部项目资产只落在 `d:\knowflow-ai`;本项目 memory-bank 独立,不与任何其他项目共享。

## 自动 Git 提交与推送

> Git 纪律(2026-09-09 人拍板):已关联 GitHub 远程仓库 `origin → github.com/wuhu-1238888/knowflow-ai`(**公开仓库**,分支 `main`)。GitHub 是项目的正式版本历史,不只是备份。**每次提交前必须执行敏感信息检查**(API Key/Token/Password/.env;`.env`/`.env.*` 已在 .gitignore,仅豁免空的 `.env.example`),检查通过方可提交;公开仓库下该项为硬性前置。

每当完成一个完整的功能点、任务或阶段后,自动执行「提交 + 推送」流程,**不再询问用户是否提交/推送**。

### 标准流程

1. 检查 `git status` 与 `git diff`,确认改动内容与范围
2. 敏感信息检查(API Key、Token、Password、`.env` 等)
3. 运行必要的测试、lint 或 build;测试失败优先修复,无法修复则如实汇报失败原因,不伪装成功
4. `git add .`(敏感检查已前置完成)
5. 创建清晰 commit:`feat: add xxx` / `fix: fix xxx` / `refactor: improve xxx` / `docs: update xxx` 等;禁止 `update` / `change` / `test` / `fix stuff` 这类无信息量的 message
6. `git push`(当前分支 → origin)
7. 汇报:本次完成的任务、commit message、commit hash、push 是否成功

### 提交粒度

以一个「完整、可解释、可验证的开发步骤」为单位提交;同一任务内的微调(按钮、间距、字体等)合并为一次 commit,不逐行提交。

### 必须暂停并询问用户的情况

1. 出现 Git 冲突
2. 远端存在本地没有的新提交(无法安全直接 push)
3. 目标 GitHub 仓库已存在且非空(首次关联/创建时)
4. 认证或权限问题(GitHub 登录失效、无建仓/推送权限、push 被拒)
5. push 失败且无法安全自动解决(禁止反复 force push,先分析失败原因)
6. 发现可能包含敏感信息的文件

### 禁止操作(未经用户明确允许,不得执行)

- `git push --force`
- `git reset --hard`
- `git clean -fd`
- squash / rebase 已发布到 GitHub 的历史、删除 commit
- 删除远端分支、删除远端仓库、覆盖远端内容
- 修改 CareerOS-AI 仓库或 `D:\AI-Product-Workflow` 中的通用工作流(本项目只操作 KnowFlow AI)

## 工作纪律

- 只跑一个 dev server;build 必须在无 dev server 时执行
- 生成数据库引擎/迁移前停掉 dev server
- 临时脚本用完即删
- 测试夹具使用固定日期/固定数据,不做日期相对锚定
- 每个编码任务走 SOP/03 的 11 步循环;验收与 Blocker/遗留判定按 SOP/04
- 测试随功能提交,不设独立测试阶段

## 工作流指引

- 各 Stage 深读位置:`D:\AI-Product-Workflow\SOP\`(01 核心流程 / 02 类型适配 / 03 AI Coding / 04 阶段验收,只读)
- 模板暂存区:`docs/templates/`(按需取用,Stage 10 完成后删除并在 progress.md 记录)
