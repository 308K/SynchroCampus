# 部署交接文档（后端 agent 必读）

> 本文档面向负责**后端部署**的 agent / 同学。前端由 Cloudflare Pages 托管，后端由闲置云服务器 + Cloudflare Tunnel 穿透。
> 域名规划：`synchro.kkn.moe`（前端 Pages）与 `api.synchro.kkn.moe`（后端 Tunnel）——**同一个注册域名（zone），两个主机名**。

## 0. 架构总览

```
浏览器 ── https://synchro.kkn.moe ────────> Cloudflare Pages（dist/ 静态产物）
        │  fetch https://api.synchro.kkn.moe/api/*（CORS + Bearer JWT）
        └── https://api.synchro.kkn.moe ──> Cloudflare Tunnel (cloudflared)
                                              └── http://127.0.0.1:3001（Bun + Elysia 2 + SQLite WAL）
```

- **同域说明**：Cloudflare 允许同一 zone 下不同主机名分别指向 Pages 与 Tunnel，TLS 证书均由 Cloudflare 自动签发，无需 Let's Encrypt。
  ⚠️ 但**同一个主机名不能同时指向 Pages 和 Tunnel**（一个主机名只有一个源）。若坚持前端后端完全同主机名，走「方案 B」（见 §4）。
- 前端为 hash 路由（`/#/room/xxx`），Pages **无需**配置 SPA fallback / `_redirects`。
- 人机验证为 Cloudflare Turnstile：前端组件在 `synchro.kkn.moe` 渲染，后端向 siteverify 校验并核对 hostname 白名单（`TURNSTILE_HOSTNAMES`）。

## 1. Cloudflare Pages（前端）

| 配置项 | 值 |
| --- | --- |
| 构建命令 | `bun install && bun run build`（正确；Pages 依据 `bun.lock` 自动使用 Bun） |
| 输出目录 | `dist` |
| 构建环境变量 | `VITE_API_BASE=https://api.synchro.kkn.moe` |
| 自定义域 | `synchro.kkn.moe`（Pages → Custom domains；如需 `www` 一并添加） |

要点：
- `VITE_API_BASE` 是**构建期**变量，改后必须重新触发部署；留空则前端回退到 `window.location.origin`（仅方案 B 可用）。
- 未配置 `VITE_API_BASE` 时前端会请求 Pages 自身域名的 `/api/*` → 404，这是最常见的联调故障。

## 2. 云服务器（后端）

### 2.1 系统依赖
- Bun ≥ 1.4（`curl -fsSL https://bun.sh/install | bash`），项目代码 `git clone` 到 `/opt/synchrocampus`。
- 无需 Node、无需 Nginx、无需证书（Tunnel 终结 TLS 后回源明文 HTTP）。

### 2.2 环境变量（`/opt/synchrocampus/.env`，权限 600，严禁入库）

```ini
# Turnstile Secret Key（Cloudflare Dashboard → Turnstile → 组件详情，与 Site Key 0x4AAAAAAF13JTQAycn2077e 配对）
TURNSTILE_SECRET=****
# siteverify 的前端主机名白名单：只填前端域名，切勿包含 localhost/127.0.0.1
TURNSTILE_HOSTNAMES=synchro.kkn.moe
# JWT 签名密钥：固定值，openssl rand -hex 32；更换会使所有会话失效
JWT_SECRET=****
# 方案 A（Pages + api 子域）必须填前端源；方案 B 留空
CORS_ORIGINS=https://synchro.kkn.moe,https://www.synchro.kkn.moe
PORT=3001
# DB_PATH=data/synchro.db   # 默认值即可；SQLite 单文件 + WAL
```

⚠️ 同时去 **Cloudflare Dashboard → Turnstile → 组件设置 → 主机名** 添加 `synchro.kkn.moe`（与 `www` 如启用），否则组件在生产域名下无法出票。

### 2.3 systemd 常驻

```ini
# /etc/systemd/system/synchrocampus.service
[Unit]
Description=SynchroCampus API (Bun + Elysia 2)
After=network.target

[Service]
WorkingDirectory=/opt/synchrocampus
EnvironmentFile=/opt/synchrocampus/.env
ExecStart=/root/.bun/bin/bun src/server/index.ts
Restart=always
RestartSec=2
# SQLite WAL 需要同目录写权限；data/ 已 gitignore，注意备份
ReadWritePaths=/opt/synchrocampus/data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now synchrocampus
journalctl -u synchrocampus -f     # 日志
```

启动时自动执行幂等建库（无迁移步骤）与演示房间种子（`demo` 房间，滚动日期）。

### 2.4 更新流程

```bash
cd /opt/synchrocampus && git pull && bun install && systemctl restart synchrocampus
```

## 3. Cloudflare Tunnel（穿透）

```bash
# 安装 cloudflared 后：
cloudflared tunnel login                      # 选择 kkn.moe zone
cloudflared tunnel create synchro-api
cloudflared tunnel route dns synchro-api api.synchro.kkn.moe   # 自动写 CNAME 到 <id>.cfargotunnel.com
```

`~/.cloudflared/config.yml`：

```yaml
tunnel: synchro-api
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: api.synchro.kkn.moe
    service: http://127.0.0.1:3001
  - service: http_status:404
```

```bash
cloudflared service install    # 注册为系统服务
systemctl status cloudflared
```

要点：
- Tunnel 回源为明文 HTTP 即可（CF 边缘已 TLS）；**不要**在 3001 上再套 Nginx/证书。
- 后端读取客户端 IP：CF 会带 `CF-Connecting-IP` / `X-Forwarded-For`，代码已取 `x-forwarded-for` 首段传给 siteverify 的 `remoteip`。
- 若 CF 面板开启 Under Attack Mode，Turnstile 与 Tunnel 可共存，无需额外配置。

## 4. 方案 B（可选）：完全同主机名，弃用 Pages

若坚持 `synchro.kkn.moe` 一个主机名同时服务前端与 API：
1. 服务器执行 `bun run build` 生成 `dist/`，用 `bun src/server/index.ts` 单进程托管（代码已内置 dist 静态托管 + `/api` 优先）。
2. Tunnel ingress 主机名改为 `synchro.kkn.moe`（+ `www.synchro.kkn.moe` 如需要）→ `http://127.0.0.1:3001`。
3. 前端**不设** `VITE_API_BASE`（同源 `/api`），`CORS_ORIGINS` 留空。
4. 代价：失去 Pages 边缘缓存/自动回滚；静态资源更新依赖服务器发布。

## 5. 上线验证清单（逐项执行）

```bash
# 1) 后端存活
curl -s https://api.synchro.kkn.moe/api/health            # {"ok":true}

# 2) CORS 预检（必须回显 origin 且 allow-headers 含 authorization）
curl -si -X OPTIONS https://api.synchro.kkn.moe/api/auth/login \
  -H 'Origin: https://synchro.kkn.moe' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type' | head -12

# 3) Turnstile 已生效：空 token 注册应 403（若 503 = TURNSTILE_SECRET 未配置）
curl -s -X POST https://api.synchro.kkn.moe/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"probe-user","password":"probe123456","turnstileToken":""}'

# 4) 前端：浏览器打开 https://synchro.kkn.moe → 注册（Turnstile 出票）→ 建房 → 涂抹 → 定案
# 5) 演示模式：首页「演示模式」按钮 → 进入 demo 房间（免登录）
# 6) 重放防护（可选）：抓一次真实 cf-turnstile-response，重放同一 token 应 403
```

本地回归（在后端服务器上）：`bun scripts/smoke.ts`（需 API 在 3001 运行；直注测试用户绕过 Turnstile，跑完自动清理）。

## 6. 运维与备份

- **备份**：`sqlite3 data/synchro.db 'PRAGMA wal_checkpoint(TRUNCATE)'` 后拷贝 `data/synchro.db`（单文件即全量）；建议 cron 每日一次异地。
- **日志**：`journalctl -u synchrocampus`；cloudflared 日志 `journalctl -u cloudflared`。
- **回滚**：`git checkout <tag> && bun install && systemctl restart synchrocampus`。
- **密钥轮换**：`JWT_SECRET` 轮换会使全部会话失效（可接受）；`TURNSTILE_SECRET` 轮换在 Dashboard 完成后再改 `.env` 并重启。
- **演示房间**：`demo` 房间与「演示房主」账号为内建演示数据，答辩可用；如需关闭，删除 `src/server/api.ts` 中 `/demo/*` 两个路由并重启（种子函数保留无副作用）。

## 7. 常见故障速查

| 现象 | 原因 |
| --- | --- |
| 前端注册/登录报 503 | 后端 `.env` 缺 `TURNSTILE_SECRET` |
| 前端报 403「来源域名不在白名单」 | `TURNSTILE_HOSTNAMES` 未含 `synchro.kkn.moe`，或 Dashboard 组件主机名未添加 |
| 前端所有 `/api` 404 | Pages 未设 `VITE_API_BASE` 或设错（方案 A） |
| CORS 报错缺 authorization | 预检未过：确认 `CORS_ORIGINS` 含前端源（方案 A） |
| Tunnel 502 | 3001 未监听 / systemd 未启动 / ingress service 地址写错 |
| 会话频繁失效 | `JWT_SECRET` 留空（每次重启随机）——生产必须固定 |
