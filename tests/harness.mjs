/**
 * 测试脚手架：断言器 / 假引擎 / ModContext 工厂 / 音频环境桩。
 *
 * 假植物类里的监听器名与射击事件名严格照抄 docs/ENGINE-NOTES.md 中
 * 逐个核对过的表。改这张表之前先回引擎数据源确认，
 * 否则会出现「测试通过、真机不触发」。
 */

// ─────────────────────── 断言器 ───────────────────────

export const counters = { pass: 0, failures: [] }

export function ok(cond, label, extra) {
  if (cond) {
    counters.pass += 1
    console.log(`  ✅ ${label}`)
  } else {
    counters.failures.push(label + (extra ? ` :: ${extra}` : ''))
    console.log(`  ❌ ${label}${extra ? ' :: ' + extra : ''}`)
  }
}

export function near(actual, expected, tol, label) {
  const diff = Math.abs(actual - expected)
  ok(diff <= tol, label, `实际 ${actual.toFixed(3)} 期望 ${expected} 容差 ${tol}`)
}

export function section(title) {
  console.log(`\n===== ${title} =====`)
}

export function summary() {
  console.log('\n' + '='.repeat(52))
  console.log(`通过 ${counters.pass} 项，失败 ${counters.failures.length} 项`)
  if (counters.failures.length) {
    console.log('失败明细：')
    for (const f of counters.failures) console.log('  · ' + f)
    process.exitCode = 1
  } else {
    console.log('全部断言通过 ✅')
  }
  console.log('='.repeat(52))
  return counters.failures.length === 0
}

// ─────────────────────── 假植物类 ───────────────────────

export class PlantBase {
  constructor(id, peaType) {
    this.ID = id
    this._own = { PeaType: peaType || 'pea', PeaTypePlantfood: 'pea_food' }
    this._fooding = false
    this.shots = []
  }
  get objdataOwn() { return this._own }
  get fooding() { return this._fooding }
  set fooding(v) { this._fooding = v }
  _shoot() { this.shots.push(this._own.PeaType) }
  animationListener(e) { if (e && e.name === 'Shoot') this._shoot() }
}

export class PeashooterPlant extends PlantBase {
  constructor(id, peaType) { super(id === undefined ? 0 : id, peaType) }
  onFoodLeftPeaCountDec() { this.shots.push(this._own.PeaTypePlantfood) }
}

// 与引擎一致：MegaGatlingPeaPlant extends PeashooterPlant，且自己定义 animationListener
export class MegaGatlingPeaPlant extends PeashooterPlant {
  constructor() { super(9, 'pea'); this.upgraded = false }
  animationListener(e) {
    const n = e && e.name
    if (n === 'Shoot5') { if (!this.upgraded) return }
    else if (n !== 'Shoot') return
    this._shoot()
  }
}

export class SplitPeaPlant extends PlantBase {
  constructor(id) { super(id === undefined ? 225 : id, 'pea') }
  onFoodLeftPeaCountDec() { this.shots.push(this._own.PeaTypePlantfood) }
  _shootBack(noSound, forceNoSound, peaType) {
    this.shots.push(peaType === undefined ? this._own.PeaType : peaType)
  }
}

export class ThreePeaterPlant extends PlantBase {
  constructor(id) { super(id === undefined ? 222 : id, 'pea') }
  _shoot3(lane, velocity, peaType) {
    this.shots.push(peaType === undefined ? this._own.PeaType : peaType)
  }
}

export class SlingPeaPlant extends PlantBase {
  constructor(id) { super(id === undefined ? 226 : id, 'pea') }
  animationListener(e) {
    if (e && e.name === 'shoot') this._shoot(this._fooding ? this._own.PeaTypePlantfood : this._own.PeaType)
  }
  _shoot(peaType) { this.shots.push(peaType) }
}

export class PrimalPeashooterPlant extends PlantBase {
  constructor(id) { super(id === undefined ? 220 : id, 'pea') }
  animationListener(e) { if (e && e.name === 'Shoot') this._shoot() }
}

export class MusicController {}
MusicController._volumeScalePause = 1
MusicController.MusicVolume = 1

/**
 * 引擎基类 Plant 的最小还原。
 * 关键是两个成员：
 *   · specialPlantUpdate —— 每帧调用，钩子挂在这里
 *   · plantCDScaleSetter —— 写入限时攻速缩放并起倒计时
 *   · _cdScale getter     —— 攻速计算实际读的就是它
 * 这三者的关系照 docs/ENGINE-NOTES.md 第 8 节抄，不能凭印象改。
 */
export class Plant {
  constructor(id, peaType) {
    this.ID = id
    this._own = { PeaType: peaType || 'pea' }
    this._cdScaleByPlant = 1
    this._cdScaleByPlantCD = 0
    this._cdScaleFightAlone = 1
    this.cdScaleWrites = []
  }
  get _cdScale() { return this._cdScaleByPlant * this._cdScaleFightAlone }

  /**
   * 每帧入口。引擎里就是它负责调用 specialPlantUpdate 并递减缩放倒计时。
   * 没有任何植物子类覆写它 —— 攻速增益的钩子必须挂在这里。
   */
  characterUpdate(dt) {
    this.specialPlantUpdate(dt, 0, 0)
    if (this._cdScaleByPlantCD > 0) {
      this._cdScaleByPlantCD -= dt
      if (this._cdScaleByPlantCD <= 0) this._cdScaleByPlant = 1
    }
  }

  specialPlantUpdate(dt, a, b) { this._lastUpdateDt = dt }

  plantCDScaleSetter(scale, seconds) {
    this._cdScaleByPlantCD = Math.max(seconds, this._cdScaleByPlantCD)
    if (this._cdScaleByPlantCD > 0) this._cdScaleByPlant = scale
    this.cdScaleWrites.push([scale, seconds])
    return true
  }
}

/**
 * 模拟真实植物的形态：自己覆写 specialPlantUpdate（引擎里 96 个植物模块都这么干），
 * 但继承基类的 characterUpdate。攻速增益这种形态下也必须生效。
 */
export class OverridingPlant extends Plant {
  constructor(id, peaType) { super(id, peaType); this.ownUpdateCalls = 0 }
  specialPlantUpdate() { this.ownUpdateCalls += 1 }
}

export const CLASS_TABLE = {
  MegaGatlingPeaPlant,
  PeashooterPlant,
  SplitPeaPlant,
  ThreePeaterPlant,
  SlingPeaPlant,
  PrimalPeashooterPlant,
  MusicController,
  Plant,
}

export const engine = {
  getCc: () => ({ js: { getClassByName: (n) => CLASS_TABLE[n] || null } }),
  getClassByName: (n) => CLASS_TABLE[n] || null,
  getModuleExport: (_m, n) => CLASS_TABLE[n] || null,
}

export function makeHooks() {
  return {
    wrapMethod({ target, methodName, handler }) {
      const orig = target[methodName]
      if (typeof orig !== 'function') throw new Error('原型上没有 ' + methodName)
      target[methodName] = function (...a) {
        return handler({ thisArg: this, args: a, callNext: (...x) => orig.apply(this, x) })
      }
    },
  }
}

// ─────────────────────── 假世界 / 实体 ───────────────────────

export class FakeEntity {
  constructor(codename, alive) { this.codename = codename; this.kind = 'plant'; this.alive = alive !== false }
  snapshot() { return { codename: this.codename } }
}

/** 全局可变世界状态：各 suite 直接改这里 */
export const world = { plants: [], phase: 'running' }

/** 记录宿主回调，供断言检查 */
export const recorder = { logs: [], toasts: [], timers: [], panels: [] }

export function resetRecorder() {
  recorder.logs.length = 0
  recorder.toasts.length = 0
  recorder.timers.length = 0
  recorder.panels.length = 0
}

export function makeCtx(over) {
  const base = {
    engine,
    unsafe: { hooks: makeHooks() },
    advanced: {},
    log: {
      info: (m) => recorder.logs.push(['info', m]),
      warn: (m) => recorder.logs.push(['warn', m]),
      error: (m) => recorder.logs.push(['error', m]),
    },
    ui: { toast: (m, t) => recorder.toasts.push([t, m]) },
    controls: { definePanel: (p) => recorder.panels.push(p) },
    entities: {
      list: (q) => world.plants.filter((e) => {
        if (q.kind && e.kind !== q.kind) return false
        if (q.alive !== undefined && e.alive !== q.alive) return false
        if (q.codename && e.codename !== q.codename) return false
        return true
      }),
    },
    game: { getState: () => ({ phase: world.phase }) },
    files: { own: () => ({ readBytes: async () => FAKE_OGG }) },
    runtime: {
      setInterval: (fn, ms) => { recorder.timers.push({ fn, ms }); return () => {} },
      track: () => {},
    },
    clock: { onTick: () => () => {} },
  }
  return Object.assign(base, over || {})
}

export const FAKE_OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02])

// ─────────────────────── HTML5 Audio 环境桩 ───────────────────────

export const audioCalls = { play: 0, pause: 0, created: 0, revoked: 0 }

let savedGlobals = null

export function installAudioStubs() {
  savedGlobals = {
    document: globalThis.document,
    Blob: globalThis.Blob,
    createObjectURL: globalThis.URL && globalThis.URL.createObjectURL,
    revokeObjectURL: globalThis.URL && globalThis.URL.revokeObjectURL,
  }

  globalThis.Blob = class {
    constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type }
  }
  if (!globalThis.URL) globalThis.URL = {}
  globalThis.URL.createObjectURL = () => { audioCalls.created += 1; return 'blob:jbtmg-fake' }
  globalThis.URL.revokeObjectURL = () => { audioCalls.revoked += 1 }
  globalThis.document = {
    createElement: () => ({
      src: '', loop: false, preload: '', volume: 1, currentTime: 0,
      play() { audioCalls.play += 1; return Promise.resolve() },
      pause() { audioCalls.pause += 1 },
    }),
  }
}

export function restoreAudioStubs() {
  if (!savedGlobals) return
  if (savedGlobals.document === undefined) delete globalThis.document
  else globalThis.document = savedGlobals.document
  if (savedGlobals.Blob === undefined) delete globalThis.Blob
  else globalThis.Blob = savedGlobals.Blob
  if (savedGlobals.createObjectURL === undefined) delete globalThis.URL.createObjectURL
  else globalThis.URL.createObjectURL = savedGlobals.createObjectURL
  if (savedGlobals.revokeObjectURL === undefined) delete globalThis.URL.revokeObjectURL
  else globalThis.URL.revokeObjectURL = savedGlobals.revokeObjectURL
}
