# AGENTS.md

SynchroCampus（序时）：React 19 + Vite + Mantine v7 前端，Bun + Elysia 2(rc) + SQLite/Drizzle 后端，Eden treaty 全链路类型推导。无 monorepo、无 CI、无 lint/formatter 配置。

## 命令

- `bun run dev` — 并发起 API(:3001, bun --watch) + Web(:5173, Vite)。停栈：Windows 下杀 `bun.exe` 进程（`Get-CimInstance Win32_Process -Filter "Name='bun.exe'" | Stop-Process`）。
- `bun run typecheck` / `bun run build` / `bun run start`（单进程生产形态：Elysia 托管 `dist/`，API 路由优先）。
- **无测试框架**：`bun scripts/smoke.ts` 是唯一端到端断言（17 项，自清理），**要求 API 已在 :3001 运行**。
- PWA 图标：`bun scripts/gen-icons.ts`（pngjs 像素绘制，产出 `public/icon-*.png`）；改配色后必须重跑。

## 环境与 dev server 坑

- Bun 自动加载 `.env`（gitignored）。`scripts/dev.ts` 的 `Bun.spawn` **不能传 `env` 快照**，否则子进程读不到 `.env`。改 `.env` 后必须重启 dev 栈（watch 不重读 env）。
- `TURNSTILE_SECRET` 未配置时注册/登录返回 503 引导；配置后假 token 被真实 siteverify 拒 403。smoke 按 env 有无断言两种分支，别改死。
- Windows 上 Vite watcher 可能漏掉外部工具写入的文件，浏览器跑旧模块。**磁盘新但页面旧 → 重启 `bun run dev`**；可用 `curl.exe -s http://localhost:5173/src/client/<file>.ts` 对比 Vite 实际serve 的内容确认。
- `bun run build` 产出 `dist/` 后，:3001 会变成 SPA 托管（含 SW 注册）；开发期请走 :5173。
- `bunx vite preview` **默认继承 `server.proxy`**（/api 会被代理到 :3001），不能当作「无后端」环境测试前端降级逻辑；需要无 API 环境时用纯静态服务（如 `Bun.serve` 直接读 dist/）。
- 启动自检：`App.tsx` 的 `ApiHealthGuard` 加载后 ping 一次 `/api/health`（`pingApi()`，5s 超时），仅在不通时弹通知；改通知文案时遵守 UI 硬规则。

## 后端约定（Elysia 2 rc）

- **schema 在 handler 之前**：`.post(path, { body: t.Object(...) }, handler)`（与 Elysia 1 相反）。
- 错误一律 `return status(code, { error: message })`（`status` 从 `elysia` 导入）。用 `set.status` + return 会让 Eden 的 `data` 退化成联合/unknown。
- Eden 客户端（`src/client/api/client.ts`）必须保持 `parseDate: false`：否则 `startDate:'YYYY-MM-DD'` 被转成 `Date`，`Temporal.PlainDate.from` 抛错。
- Eden 路径参数是**函数调用式**：`api.rooms({ id }).get()`；响应统一过 `unwrap()`（Eden 2 的 `error.status` 类型为 unknown）。
- 无迁移系统：启动时幂等 DDL 建库（`src/server/db/index.ts`），SQLite WAL 于 `data/synchro.db`（gitignored）。启动即种子演示数据（`src/server/demo.ts`：房间 `demo`、房主 `demo-owner`，跨天自动滚动重置）。

## 前端约定

- 无路由库：hash 路由（`#/room/:id`），`useHashRoute` + `App.tsx` 分发。
- 时间一律走 `src/client/lib/temporal.ts`（原生 Temporal 优先 + polyfill 异步分块）；日期在 JSON 中保持字符串。
- Mantine v7 色彩方案存储 key 是 **`mantine-color-scheme-value`**；`index.html` 首帧预置脚本必须用同一 key，默认跟随系统（auto）。顶栏切换顺序固定为 系统→深→浅（`AppNavbar`）。
- 品牌色阶在 `theme.ts`，#ddaacc 为 shade 3；填充按钮用 `primaryShade {light:7,dark:6}`——**不要**在 #ddaacc 原色上放白字（对比度不足）。
- 热力图色 = OKLCH 三通道插值（`lib/oklch.ts`，hue 29°红→142°绿），经 CSS 变量 `--cell-l/--cell-c/--cell-h` 注入 `.heatmap-cell`。
- **UI 文案两条硬规则（用户强制）**：① 禁止任何 emoji，图标一律 `@tabler/icons-react`；② 中西文/数字之间不人工加空格（`text-autospace: normal` 负责），改文案时勿 reintroduce。
- Turnstile：widget `action` 必须与服务端 `TURNSTILE_ACTIONS`（signup/login）一致；token 单次有效，每次提交后 `turnstile.reset()`（AuthModal 已处理）。

## 验证流程

- 顺序：`typecheck` → `build` → 起服务 → `smoke.ts` → 浏览器实测。
- 生产部署（Pages `synchro.kkn.moe` + Tunnel `synchro-api.kkn.moe`）由独立 agent 按 `docs/DEPLOY.md` 执行；勿改动 `TURNSTILE_HOSTNAMES` / `CORS_ORIGINS` / `VITE_API_BASE` 的语义与拼写。
- 内置浏览器对该 Mantine 应用的无障碍树很稀疏：`browser.wait condition:"text"` 与 `find` 不可靠；用 `browser.evaluate` 轮询，等待逻辑写进**页面侧 async IIFE**（Code Mode 运行时无 setTimeout）。
- Turnstile 端到端：页面内覆写 `window.fetch` 捕获请求体里的 token；重放同一 token 应得 403（单次有效证明）。

## Windows / pwsh 坑

- 裸 `curl` 是 Invoke-WebRequest 别名，用 `curl.exe`；内联双引号 JSON 会被 pwsh 破坏——请求体写临时文件 `--data-binary @file`，或 `Invoke-WebRequest -SkipHttpErrorCheck`。
- 仓库未配置 git identity：提交用 `git -c user.name=... -c user.email=... commit` 或先本地配置。
