/**
 * KnowFlow AI 生产启动入口(package.json "start" 脚本)。
 *
 * - 部署平台注入 PORT(如 PocketBay 的 8080)时,next start 读取 PORT 并绑定 0.0.0.0;
 * - 本地无 PORT 时保持 3001(2026-09-09 人拍板:本地固定 3001,避免与 CareerOS 3000 抢占)。
 */
process.env.PORT = process.env.PORT || '3001';
process.argv.splice(2, 0, 'start');
require('next/dist/bin/next');
