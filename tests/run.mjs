/**
 * 测试入口：装配运行期、跑全部 suite、汇总退出码。
 *
 * 用法：
 *   node tests/run.mjs                       # 校验仓库根
 *   JBTMG_PKG_ROOT=<dir> node tests/run.mjs  # 校验解包目录
 *   JBTMG_ENTRY=<file>   node tests/run.mjs  # 指定要加载的模组入口
 *
 * 两个环境变量都支持 tools/pack.ps1 在打包后做「用发布产物复测」。
 */
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import {
  ok, section, summary,
  installAudioStubs, restoreAudioStubs,
  makeCtx, recorder, resetRecorder,
} from './harness.mjs'
import { runPlants } from './suite-plants.mjs'
import { runBgm } from './suite-bgm.mjs'
import { runPackage } from './suite-package.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const pkgRoot = process.env.JBTMG_PKG_ROOT
  ? path.resolve(process.env.JBTMG_PKG_ROOT)
  : repoRoot
const entryFile = process.env.JBTMG_ENTRY
  ? path.resolve(process.env.JBTMG_ENTRY)
  : path.join(repoRoot, 'scripts', 'main.js')
const entryUrl = pathToFileURL(entryFile).href

const entryMod = await import(entryUrl)
const mod = entryMod.default
const T = entryMod.__test__

// ─────────────────────── 0. 启动与挂载 ───────────────────────

section('0. 启动与挂载')
console.log(`  （入口：${entryFile}）`)

installAudioStubs()
resetRecorder()

const modCtx = makeCtx()
mod.startup(modCtx)
mod.setup(modCtx)
await new Promise((r) => setTimeout(r, 20))

ok(T.PLAN.length === 8, 'PLAN 含 8 个挂载点')
ok(T.PLAN.map((p) => T.attached.get(p.key)).every((v) => !!v && !v.includes('failed') && !v.includes('未找到') && !v.includes('缺少')),
  '全部挂载点都装到了方法上', JSON.stringify(T.PLAN.map((p) => T.attached.get(p.key))))
ok(T.getMusicCtrl(), 'MusicController 已定位')
ok(recorder.logs.some(([, m]) => String(m).includes('已挂载 8/8')), '日志确认 8/8 挂载')
ok(recorder.toasts.some(([t]) => t === 'success'), '弹出成功提示')
ok(recorder.panels.length === 1, '面板只创建一次', '实际 ' + recorder.panels.length)
ok(recorder.timers.length === 1 && recorder.timers[0].ms === 100, 'BGM 心跳已注册（100ms）')

section('C-0. BGM 资源加载')
ok(T.bgmState.loaded === true, 'BGM 资源加载成功', T.bgmState.loadError)
ok(T.bgmState.bytes === 6, '读取到的字节数与资源一致')
ok(recorder.panels[0] && recorder.panels[0].title === 'Just Better Than Mega Gatling', '面板标题正确')
ok(recorder.panels[0].groups.length === 4, '面板含 4 组', String(recorder.panels[0].groups.length))

// ─────────────────────── 各 suite ───────────────────────

runPlants({ T })
await runBgm({ T, modCtx, entryUrl })
runPackage({ pkgRoot })

restoreAudioStubs()
summary()
