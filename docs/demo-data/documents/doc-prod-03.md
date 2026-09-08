<!-- synthetic: true | NovaTech 虚构演示文档 -->

# NovaFlow API 说明(内部版)

> 版本:2026-06 | 适用对象:接入 NovaFlow 平台的研发人员

## 概览

NovaFlow 开放平台提供 REST API,覆盖应用管理、数据管道与告警查询三类能力。API 根地址:`https://api.novatech.example.com/v1`。

## 认证

- 所有请求需携带请求头 `Authorization: Bearer <API-Token>`。
- API Token 在控制台「个人设置 - API Token」中生成,Token 有效期最长 90 天。
- 内部研发使用 NF-ID 登录控制台生成 Token;Token 泄露请立即吊销并重新生成。

## 常用接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /v1/apps | 查询应用列表 |
| POST | /v1/apps | 创建应用 |
| POST | /v1/apps/{id}/deploy | 触发一次部署 |
| GET | /v1/alerts | 查询告警(支持时间范围过滤) |

## 限流与错误码

- 默认限流:每个 Token 每秒 10 次请求,超限返回 429。
- 常见错误码:400 参数错误、401 Token 无效、404 资源不存在、429 限流、500 平台内部错误。
- 5xx 错误可重试(建议退避 1 秒),连续失败请联系平台研发部。
