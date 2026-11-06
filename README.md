# 序时 SynchroCampus

> 基于离散时空碰撞与启发式约束规划驱动的群体日程自协同决策智能体
>
> 内蒙古大学第二届高校师生人工智能应用能力大赛 · 校园管理/校园生活应用智能体赛道
> 主题：智启北疆，联动丝路——焕新校园新形态

## 快速开始（本机预览）

前置要求：[Bun ≥ 1.1](https://bun.sh)（Node 20+ 亦可运行 Vite 前端）。

```bash
bun install          # 安装依赖
bun run dev          # 一键并发启动：API :3001（watch 热重载）+ Web :5173（Vite HMR）
```

打开 <http://localhost:5173> 即可预览。`Ctrl+C` 一键停止全部进程。

### 演示模式（免登录）

首页「进入演示模式」一键载入示例房间：7 天窗口、6 位模拟成员的全周冲突掩码、演示房主会话（可定案、可重置）。
演示数据按日期滚动：跨天后自动重置；房间内「重置演示」按钮可随时恢复初始示例状态。

### Turnstile 配置（必须）

注册/登录前，需要在 `.env` 中补齐 Cloudflare Turnstile 的 **Secret Key**：

| 变量 | 说明 |
| --- | --- |
| `TURNSTILE_SECRET` | 与 Site Key `0x4AAAAAAF13JTQAycn2077e` 配对的密钥，在 Cloudflare Dashboard → Turnstile → 组件详情页查看 |
| `VITE_TURNSTILE_SITEKEY` | 前端站点密钥（公开值，默认已内置） |
| `TURNSTILE_HOSTNAMES` | siteverify 前端主机名白名单，本地默认 `localhost,127.0.0.1` |
| `JWT_SECRET` | JWT 签名密钥（留空则每次重启自动生成临时密钥） |

填写后重启 `bun run dev` 生效。

⚠️ **本地预览前请确认**：该 Turnstile 组件的域名列表（Dashboard → 组件设置）中包含 `localhost` 与 `127.0.0.1`，否则组件在本地无法完成验证。

### 其他命令

```bash
bun run build       # 构建前端静态产物到 dist/
bun run start       # 单进程生产形态：Elysia 同时托管 API 与 dist 静态资源（:3001）
bun run typecheck   # 全链路 TypeScript 类型检查
bun scripts/smoke.ts    # 端到端 API 冒烟测试（17 项断言）
bun scripts/gen-icons.ts # 重新生成 PWA 图标（pngjs 像素绘制）
```

## 架构

```
React 19 + Vite + Mantine v7     Bun 1.1+ 运行时
┌────────────────────────┐       ┌──────────────────────────┐
│ 2D 时空涂抹网格         │       │ Elysia 2（schema-first） │
│ OKLCH 热力图            │ Eden 2│ argon2id 密码哈希         │
│ 启发式排程引擎(端侧)     │─────▶│ Turnstile siteverify     │
│ Temporal API + polyfill │ 全链路│ HMAC-SHA256 JWT          │
│ Turnstile Widget        │ 类型 │ SQLite + Drizzle (WAL)   │
│ PWA（manifest+SW）      │ 推导  └──────────────────────────┘
└────────────────────────┘
```

- **前后端通信**：`@elysia/eden` treaty 2，`import type { App }` 从服务端路由定义零样板推导全部请求/响应类型。注意配置 `parseDate: false`：本项目 `startDate/endDate` 是纯日期字符串，必须保持 string 交给 Temporal 处理（Eden 默认会把日期样字符串转成 Date，丢失"仅日期"语义）。
- **时间引擎**：全面采用 TC39 Temporal API（原生优先；旧浏览器按需加载 `temporal-polyfill` 异步分块，见构建产物 `temporal-polyfill-*.js`）。不依赖 dayjs/moment。
- **色彩引擎**：热力图在 OKLCH 知觉均匀空间对三通道插值：`L = Lmin + R·(Lmax−Lmin)`、`C = Cmin + R·(Cmax−Cmin)`、`Hue = 29° + R·(142°−29°)`（无人空闲红 → 全员有空绿，中途经黄，知觉平滑）；`R(t) = (N₁ + 0.5·N₂)/N`；无参与数据时显示低对比中性底色。品牌主色为 #ddaacc 粉紫色系（Mantine 色阶 shade 3，深 shade 用于填充按钮保证对比度）。
- **主题**：深色模式默认跟随系统（`defaultColorScheme: auto` + 首帧预置脚本读取 `prefers-color-scheme`），用户手动切换后以 localStorage 为准。
- **排程引擎**（端侧 <1ms）：`Score(W) = 100·R̄(W) − 25·P_meal − 40·P_late + 8·B_contig`，遍历全部候选窗口输出互不重叠的 Top-3。
- **安全闭环**：注册/登录嵌入 Turnstile（action `signup`/`login`），服务端 canonical siteverify（success + action + hostname 白名单三重校验）；Token 单次有效，提交后自动 `turnstile.reset()`。已用真实浏览器端到端验证：新 Token 注册成功、重放同一 Token 被 403 拒绝。
- **排版**：全局 `text-autospace: normal` + `text-spacing-trim: space-all`，中西文混排间距完全由排版引擎处理，UI 文案中不人工插入混排空格。
- **PWA**：`public/manifest.webmanifest` + `public/sw.js`（导航网络优先回退离线壳、静态资源 stale-while-revalidate、`/api/*` 仅网络）；图标由 `scripts/gen-icons.ts` 像素绘制生成（192/512/maskable）。Service Worker 仅在生产构建注册。
- **移动端**：≤48em 时导航栏变为悬浮胶囊（毛玻璃+圆角+安全区偏移），网格列宽经 CSS 变量收紧（`--sc-time-w`/`--sc-cell-w`），触控设备加大槽位命中面积。

## 目录结构

```
src/
├── client/                 # React 前端
│   ├── api/client.ts       # Eden treaty 客户端 + token 注入
│   ├── auth/               # 会话上下文与认证弹窗上下文
│   ├── components/         # TurnstileWidget / TimeSlotPainter / HeatmapBoard / AgentDecisionDeck …
│   ├── lib/                # temporal / room 几何 / mask 编码 / oklch / scheduler / ics / mock
│   └── pages/              # HomePage / RoomPage
├── server/                 # Elysia 后端
│   ├── api.ts              # 接口契约（§4.2 + 读取接口）
│   ├── turnstile.ts        # siteverify 服务端校验
│   ├── jwt.ts              # HMAC-SHA256 轻量 JWT
│   ├── auth.ts             # Bearer 会话解析
│   └── db/                 # Drizzle schema + SQLite(WAL) 初始化
scripts/dev.ts              # 并发进程管理（API + Web）
```

## 数据流（答辩演示路径）

1. 注册/登录（Turnstile → argon2id → JWT）
2. 创建房间（Temporal 日期区间 + 每日窗口 + 30 分钟槽位 → `TotalSlots = Days × (End−Start)/0.5`）
3. 分享短链/二维码（NanoID 8 位短码）
4. 成员涂抹三态位图（`"110022…"` 等长字符串，极小化载荷）
5. OKLCH 热力图 + 人员透视浮层（8 秒轮询同步）
6. 「注入 Mock 数据」一键生成 6 位模拟参与者的冲突日程
7. 决策甲板 Top-3 卡片（RingProgress 到场率 + 避开饭点/全员到齐/黄金时段标签）
8. 房主采纳 → canvas-confetti 全屏庆祝 → 房间锁定
9. 下载 RFC 5545 `.ics`（TZID:Asia/Shanghai + VALARM 提前 15 分钟）或复制 Markdown 群通告

## 部署

完整交接说明见 **[`docs/DEPLOY.md`](docs/DEPLOY.md)**（后端由独立 agent 按该文档执行）。规划摘要：

- **域名**：`synchro.kkn.moe` → Cloudflare Pages（构建命令 `bun install && bun run build`，输出 `dist`，构建期设 `VITE_API_BASE=https://synchro-api.kkn.moe`）；`synchro-api.kkn.moe` → Cloudflare Tunnel 穿透到云服务器 `127.0.0.1:3001`。同一 zone 两个主机名，TLS 均由 Cloudflare 签发。
- **后端**：云服务器 Bun + systemd 常驻 `bun src/server/index.ts`（无需 Nginx/证书）；`.env` 生产值：`TURNSTILE_SECRET`、`TURNSTILE_HOSTNAMES=synchro.kkn.moe`（切勿含 localhost）、固定 `JWT_SECRET`、`CORS_ORIGINS=https://synchro.kkn.moe`。
- **Turnstile Dashboard**：组件主机名需添加 `synchro.kkn.moe`。
- 方案 B（单主机名同域、弃用 Pages）与上线验证清单、备份回滚、故障速查均在 `docs/DEPLOY.md`。

## 备注

- `.ics` 生成采用自研构造器（`src/client/lib/ics.ts`）而非 `ics` npm 包：规范要求的 `TZID:Asia/Shanghai` + `VTIMEZONE` 块与按 75 字节 UTF-8 边界折叠在 `ics` 包公开 API 中无法表达；自研实现约 100 行且完整覆盖 RFC 5545 关键子集。
- 热力图/涂抹网格使用共享 CSS Grid 骨架（sticky 表头/时间列）而非 Mantine `Table`：手势拖拽、触控涂抹与 400+ 槽位的渲染性能在原生 div 网格上显著更优，Mantine 组件（Popover/Badge/Tooltip）用于上层交互。
- 服务端建库采用幂等 DDL（启动时 `CREATE TABLE IF NOT EXISTS`），本地预览零迁移步骤。
