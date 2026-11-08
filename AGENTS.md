# AGENTS.md

SynchroCampus（序时）：React 19 + Mantine v7 前端，Bun + Elysia 2(rc) + SQLite/Drizzle 后端，Eden treaty 全链路类型推导。**构建/开发均用 Bun 原生工具链（无 Vite）。** 无 monorepo、无 CI、无 lint/formatter 配置。

## 命令

- `bun run dev` — **单进程** Bun 全栈 dev server：http://localhost:3001（HTML 导入 + 客户端 HMR + API 同源；`BUN_DEV=1 bun --hot`）。仅 3001 一个端口，无 5173。
- `bun run build` — `scripts/build.ts`：Bun.build → `dist/`（hash 资产 + public/ 平铺 + `__SC_ENV__` 注入 + index.html 生成）。
- `bun run start` — 生产单进程：Elysia 托管 API + dist 静态资源（:3001）。`bun run start` 与 `bun run dev` 互斥使用同一端口。
- `bun run typecheck` — `bun check`（Bun 内置 TS7 检查器，语义与 `tsc --noEmit` 一致且更快；唯一的静态校验，无 lint/test 框架）。`typescript` devDependency 保留供编辑器 IntelliSense。
- `bun scripts/smoke.ts` — 端到端 API 断言（20 项，自清理），**要求 API 已在 :3001 运行**。
- `bun scripts/check-css.ts` — 审计 dist CSS（backdrop-filter 双写、light-dark 残留），改样式/换构建器后必跑。
- PWA 图标：`bun scripts/gen-icons.ts`（pngjs 像素绘制）；改配色后必须重跑。

## 工具链坑（血泪换来的，勿回退）

- **CSS 严禁使用 `light-dark()`**：Vite 8/lightningcss 时代曾把 `light-dark(A,B)` 编译成 `var(--lightningcss-*)` 双值声明且不生成定义 → 整条 background/border 非法被丢（毛玻璃事件根因）。现在虽换 Bun.build，此规则仍保留：深浅色一律用 `[data-mantine-color-scheme='dark']` 属性选择器（还能正确响应手动主题切换，light-dark 只认系统偏好）。
- **data-mantine-color-scheme 属性挂在 `<html>` 上**：涉及 html/body 的深色规则必须写 `html[data-mantine-color-scheme='dark'] body`；写成 `[data-mantine-color-scheme='dark'] html body` 永不匹配（html 没有祖先）→ 曾导致深色模式下页面保持浅色底、组件深色的混合异常。后代元素规则（如 `.sc-grid-wrap`）用前缀形式没问题。
- **Bun dev 的模块内联怪癖**：`bun --hot` 启动时打包 HTML，跨模块常量可能被内联为空串（曾见 `API_BASE → ""`）。调用点已加 `|| window.location.origin` 兜底；新增跨模块常量导入时同样在消费点兜底。
- **Bun dev HTML 管道会解析 index.html 里的所有 `<link>` 引用**——引用 public/ 资源必须写**相对路径** `public/xxx`（绝对 `/xxx` 会 Build Failed）；`scripts/build.ts` 生成产物时会重写回根路径（public/ 平铺进 dist）。
- **HTML 导入必须静态语法**：`import appHtml from '../../index.html'`（路径务必数对层级）；`await import('../index.html')` 动态导入会报 Cannot find module。
- `bun --hot` 对 server 与 client 同时生效；**改动 src/client 后若页面没变，重启 dev**（HTML 管道在启动时打包，HMR 偶发不触发重打包）。
- 停 dev 后检查 3001 端口残留（`Get-NetTCPConnection -LocalPort 3001 -State Listen`），--hot 会话可能留下占用端口的进程。
- `TURNSTILE_SECRET` 未配置时注册/登录返回 503 引导；配置后假 token 被真实 siteverify 拒 403。smoke 按 env 有无断言两种分支，别改死。
- 启动自检：`App.tsx` 的 `ApiHealthGuard` 加载后 ping 一次 `/api/health`（`pingApi()`，5s 超时），仅在不通时弹通知。

## 后端约定（Elysia 2 rc）

- **schema 在 handler 之前**：`.post(path, { body: t.Object(...) }, handler)`（与 Elysia 1 相反）。
- 错误一律 `return status(code, { error: message })`（`status` 从 `elysia` 导入）。用 `set.status` + return 会让 Eden 的 `data` 退化成联合/unknown。
- Eden 客户端（`src/client/api/client.ts`）必须保持 `parseDate: false`：否则 `startDate:'YYYY-MM-DD'` 被转成 `Date`，`Temporal.PlainDate.from` 抛错。
- Eden 路径参数是**函数调用式**：`api.rooms({ id }).get()`；响应统一过 `unwrap()`（Eden 2 的 `error.status` 类型为 unknown）。
- 无迁移系统：启动时幂等 DDL 建库（`src/server/db/index.ts`），SQLite WAL 于 `data/synchro.db`（gitignored）。启动即种子演示数据（`src/server/demo.ts`：房间 `demo`、房主 `demo-owner`，跨天自动滚动重置；演示房间禁止删除）。列级迁移用 `PRAGMA table_info` 探测后 `ALTER TABLE`（见 `register_ip` 先例）。
- `src/server/jwt.ts` 为用户加固版：`signJwt(payload, expiresInSeconds?)` / `verifyJwt(token)` **不接收 secret 参数**（内部 CryptoKey 缓存）；`JWT_SECRET` 必须 ≥32 字节，生产缺失直接抛错；users 表含 `register_ip`（注册时经 `clientIp()` 记录）。调用方勿再传 secret。
- 房间生命周期：房主 `DELETE /api/rooms/:id`（级联删参与者）；成员 `POST /api/rooms/:id/leave`（登录按 userId、匿名按昵称；房主不可退出自己的房间）。

## 前端约定

- 无路由库：hash 路由（`#/room/:id`），`useHashRoute` + `App.tsx` 分发。
- 时间一律走 `src/client/lib/temporal.ts`（原生 Temporal 优先 + polyfill 异步分块）；日期在 JSON 中保持字符串。
- Mantine v7 色彩方案存储 key 是 **`mantine-color-scheme-value`**；`index.html` 首帧预置脚本必须用同一 key，默认跟随系统（auto）。顶栏切换顺序固定为 系统→深→浅（`AppNavbar`）。
- 品牌色阶**程序化生成**于 `theme.ts`：以 #ddaacc 的 OKLCH（L/C/H）为锚点、每级 0.06 亮度等差展开 10 级（shade 3 精确锚定 #ddaacc），内置 sRGB 色域收缩；改色只改 `ANCHOR` 与步长。填充按钮 `primaryShade {light:7, dark:7}`（对白字 4.93:1 过 AA）；首页大标题色 `HERO_TITLE_LIGHT`（浅色自动选对 #F3F0EE ≥3:1 的最浅层）/ `HERO_TITLE_DARK`（#ddaacc 本色）。
- 热力图色 = OKLCH 三通道插值（`lib/oklch.ts`，hue 29°红→142°绿），经 CSS 变量 `--cell-l/--cell-c/--cell-h` 注入 `.heatmap-cell`。
- **UI 文案两条硬规则（用户强制）**：① 禁止任何 emoji，图标一律 `@tabler/icons-react`；② 中西文/数字之间不人工加空格（`text-autospace: normal` 负责），改文案时勿 reintroduce。
- Turnstile：widget `action` 必须与服务端 `TURNSTILE_ACTIONS`（signup/login）一致；token 单次有效，每次提交后 `turnstile.reset()`（AuthModal 已处理）；组件主题用 `useComputedColorScheme()`（解析 auto，勿用 `useMantineColorScheme().colorScheme`——auto 模式下它返回字面量）。
- 胶囊导航栏：全宽度生效（非媒体查询）；胶囊内按钮统一 999px 圆角（`.sc-capsule-nav` 规则）；Logo 40px 圆与胶囊左端半圆同心（容器 `px={16}` + header 高 96 的几何配平，改高度时同步）。

## 验证流程

- 顺序：`typecheck` → `build` → `check-css.ts` → 起服务 → `smoke.ts` → 浏览器实测。
- 生产部署（Pages `synchro.kkn.moe` + Tunnel `synchro-api.kkn.moe`）由独立 agent 按 `docs/DEPLOY.md` 执行；勿改动 `TURNSTILE_HOSTNAMES` / `CORS_ORIGINS` / `VITE_API_BASE` 的语义与拼写。
- 内置浏览器（Review 面板）对该应用的 a11y 树稀疏且 **rAF 冻结**：Mantine Modal/Popover/Transition 打不开（依赖 rAF）+ backdrop-filter 渲染不出（GPU 合成禁用）——都是**环境限制**不是 bug，验收 UI 交互与毛玻璃必须在真实浏览器窗口；脚本侧用 `browser.evaluate` 轮询（等待逻辑写进页面侧 async IIFE，Code Mode 无 setTimeout）。
- Turnstile 端到端：页面内覆写 `window.fetch` 捕获请求体里的 token；重放同一 token 应得 403（单次有效证明）。

## Windows / pwsh 坑

- 裸 `curl` 是 Invoke-WebRequest 别名，用 `curl.exe`；内联双引号 JSON 会被 pwsh 破坏——请求体写临时文件 `--data-binary @file`，或 `Invoke-WebRequest -SkipHttpErrorCheck`。pwsh 内联长命令易被 shell 扫描器拒绝时，拆成多条或落盘脚本再 `bun` 执行。
- 仓库未配置 git identity：提交用 `git -c user.name=... -c user.email=... commit` 或先本地配置。
- **git 推送**：origin 为 SSH `git@github.com:308K/SynchroCampus.git`（gh CLI 账号 308K，SSH 认证可用；`known_hosts` 已记录并核对过 GitHub 官方 ED25519 指纹）。历史备注：本机曾因代理接管 DNS（198.18.x 虚假 IP）导致 SSH 不可用，当时临时切过 HTTPS+schannel；若推送再报 `Connection closed by 198.18.x`，是代理/VPN 又接管了 DNS，关闭或切换分流规则即可，勿改 remote。
