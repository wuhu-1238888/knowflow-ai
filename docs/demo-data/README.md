# NovaTech 演示数据(Demo Data)

> **Synthetic / Fictional Demo Data 声明**:本目录全部内容为**虚构演示数据**——NovaTech 是一家不存在的公司,所有文档、制度、数字均为虚构,仅用于作品集演示 RAG 能力与评测。**不得将其描述为真实企业客户或真实商业项目。**

## documents/(20 篇虚构知识文档)

| 命名 | 内容 | 格式 | 评测用途 |
| --- | --- | --- | --- |
| doc-hr-01 | 员工手册 | md | 干扰文档(账号安全概述)、多文档 |
| doc-hr-02 | 入职 checklist | md | 多文档(C05) |
| doc-hr-03 | 差旅费用报销制度(2024 版,旧版残留) | md | 冲突(C13/C14)、无答案(C12) |
| doc-hr-04 | 差旅费用报销制度(2026 版,现行) | md | 冲突(C13/C14)、无答案(C12) |
| doc-hr-05 | 请假制度 | md | 精确关键词(C01)、语义(C03) |
| doc-it-01 | 账号申请与密码 | txt | 多文档(C05)、干扰(C08) |
| doc-it-02 | VPN 配置 | md | 精确关键词(C02) |
| doc-it-03 | 邮箱设置 | txt | 语义(C04) |
| doc-it-04 | 打印机与会议设备 | md | 干扰(C07) |
| doc-prod-01 | NovaFlow 产品总览 | html | 背景知识 |
| doc-prod-02 | 术语表 | md | 专业术语(C09/C10) |
| doc-prod-03 | NovaFlow API 说明 | md | 背景知识 |
| doc-prod-04 | FAQ | md | 背景知识 |
| doc-tech-01 | 部署手册 | md | 背景知识 |
| doc-tech-02 | 系统故障排查 | txt | 干扰文档(C07) |
| doc-tech-03 | 发布流程(POD) | md | 多文档(C06) |
| doc-tech-04 | 代码规范 | html | 多文档(C06) |
| doc-proj-01 | 团队简介 | md | 背景知识 |
| doc-proj-02 | Project-X 项目说明 | txt | 背景知识 |
| doc-proj-03 | 会议纪要模板 | md | 背景知识 |

**格式说明**:md/txt/html 为源文件,直接入库;PDF 与 DOCX 变体由源文件在编码期(Stage 11)生成,用于 FR-01 的 5 格式解析验收——仓库不存放生成产物,保证可复现。

## evaluation/(评测夹具)

`cases.yaml`:14 例评测样例(7 类场景),格式与标注要求见 `docs/evaluation-plan.md`。**人工标注签字后才可用于评测。**

## 命名与一致性约定

- 文件名:`doc-<类别>-<序号>`,类别:hr/it/prod/tech/proj。
- 虚构公司设定:NovaTech,约 300 人 SaaS 软件公司,核心产品 NovaFlow 云平台,总部虚构城市"滨海市",域名一律使用 `novatech.example.com`(example.com 保留域,天然虚构)。
- 每篇文档头部含 `synthetic: true` 标注(md/html 用注释,txt 用首行标记),分块解析时剥离。
