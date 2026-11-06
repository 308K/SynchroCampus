// 并发开发进程管理：API（Bun watch）+ Web（Vite HMR）
const jobs: Array<{ name: string; proc: Bun.Subprocess<'ignore', 'pipe', 'pipe'> }> = []
let shuttingDown = false

const C = { magenta: '\x1b[35m', cyan: '\x1b[36m', reset: '\x1b[0m', dim: '\x1b[2m' }

async function pump(name: string, stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder()
  const reader = stream.getReader()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim().length === 0) continue
      console.log(`${C.dim}[${name}]${C.reset} ${line}`)
    }
  }
  if (buffer.trim()) console.log(`${C.dim}[${name}]${C.reset} ${buffer}`)
}

function start(name: string, args: string[]) {
  // 不显式传 env：让子进程继承环境并由 Bun 自行加载 .env（否则 env 快照会阻断 .env 热加载）
  const proc = Bun.spawn([process.execPath, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  jobs.push({ name, proc })
  void pump(name, proc.stdout as ReadableStream<Uint8Array>)
  void pump(name, proc.stderr as ReadableStream<Uint8Array>)
  void proc.exited.then((code) => {
    if (shuttingDown) return
    console.log(`${C.magenta}[dev]${C.reset} 进程 [${name}] 已退出（code=${code}），正在停止其余进程…`)
    shutdown(1)
  })
}

function shutdown(code: number): void {
  if (shuttingDown) return
  shuttingDown = true
  for (const { name, proc } of jobs) {
    try {
      // Windows 下 vite 以 node 孙进程运行，必须按进程树终止（否则留下占用端口的孤儿）
      if (process.platform === 'win32') {
        Bun.spawnSync(['taskkill', '/PID', String(proc.pid), '/T', '/F'], { stdout: 'ignore', stderr: 'ignore' })
      } else {
        proc.kill()
      }
    } catch {}
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log(`${C.magenta}[dev]${C.reset} SynchroCampus 开发模式启动：API :3001 + Web :5173`)
start('api', ['run', 'dev:api'])
start('web', ['run', 'dev:web'])
