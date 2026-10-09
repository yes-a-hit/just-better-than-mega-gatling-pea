/**
 * Just Better Than Mega Gatling — 运行期入口 v1.0.0
 * Copyright (c) 2026 YG — MIT License（完整条款见仓库根 LICENSE，素材与引用声明见 NOTICE.md）
 * ────────────────────────────────────────────────────────────────
 * 本包把以下两个模组整合进一个入口，并新增「大哥 BGM 覆盖」：
 *
 *   A. 大哥·元素豌豆   (原 yg.megagatling-elemental v1.0.3)
 *      超级机枪射手 megagatling 每次攻击按 35/15/15/15/10/10
 *      随机发射六种元素豌豆；阳光消耗在 jsons/objects/PlantProps.json 里提到 600。
 *
 *   B. 融合大哥         (原 yg.mgp-fusion v1.3.0)
 *      四株 MGP 大招按 50/25/25 混入冰豆火豆（双发 / 三线 / 裂荚正背面 / 海豌豆），
 *      超级军炮大招按 60/35/5 抽原豌 / AKEE / 椰子，
 *      超级原豌普攻 10% 改发流星花的流星。
 *
 *   C. 大哥 BGM 覆盖     (本版新增)
 *      场上存在大哥系植物时，用包内 audio/mega-gatling-bgm.ogg 顶替关卡 BGM；
 *      大哥全部阵亡、或关卡结束（won/lost/ended）、或离开战斗场景时，
 *      自动把音乐通道交还引擎，恢复原本的 BGM。
 *
 * ── 两个源模组的挂载点为何不冲突 ──
 *   A 挂的是 MegaGatlingPeaPlant.prototype.animationListener（本类自定义）。
 *   B 挂的是 PeashooterPlant / SplitPeaPlant / ThreePeaterPlant /
 *   SlingPeaPlant / PrimalPeashooterPlant 的原型，并用植物 ID 白名单卡死范围。
 *   MegaGatlingPeaPlant 只出现在 A 的挂载点上，两套钩子互不覆盖。
 *   注意：A 沿用原模组行为，不做 ID 过滤；若将来版本出现
 *   「继承自 MegaGatlingPeaPlant」的融合变体，它们会一并走 A 的随机弹。
 *
 * ── BGM 覆盖的引擎依据（对 0.15.0 assets/main/index.js 逐段核对）──
 *   1. 关卡 BGM 全部由 SoundManager 播放，音量按下式每帧重算：
 *        currentPlayingComponent.volume = MusicVolume * MusicController._volumeScalePause
 *      钢琴 / 节日 / 插播通道同理。
 *   2. _volumeScalePause 是引擎自己的「音乐音量标量」：
 *        · SoundsController.ts 初始化 = 1
 *        · UI.ts 暂停时每帧 -1/60 渐降到 0，恢复时 +1/60 渐升回 1
 *        · mainScene / worldMapScene 进场时 = 0 再 tween 到 1
 *        · SoundManager.start() / KeyListener 处 = 1
 *      也就是说：把它压到 0 就等于静音全部「音乐」通道，
 *      而音效走独立的 SoundFXController，完全不受影响。
 *   3. 恢复时把它写回 1 是安全的 —— 引擎的暂停 / 淡入逻辑每帧都会自我修正，
 *      不需要（也无法可靠地）保存旧值；写 0 中途被引擎复位也只是丢一帧。
 *   4. 因此本模组不接管引擎的选曲逻辑，只做「静音 + 自带播放器」，
 *      任何时刻松手，引擎下一帧就把音量写回它认为正确的值。
 */

// ═══════════════════════ 公共工具 ═══════════════════════

const diagLines = []

function note(line) {
  try { diagLines.push(String(line)) } catch (err) { /* 诊断不影响流程 */ }
}

function errText(err) {
  return err && err.message ? err.message : String(err)
}

function safeKeys(obj) {
  try { return obj ? Object.keys(obj).join(',') : '(不存在)' } catch (err) { return '(读取失败)' }
}

function clamp01(v) {
  const n = Number(v)
  if (!isFinite(n)) return 1
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** 按权重抽一项 */
function pick(table) {
  let total = 0
  for (let i = 0; i < table.length; i++) total += table[i].weight
  let roll = Math.random() * total
  for (let i = 0; i < table.length; i++) {
    roll -= table[i].weight
    if (roll < 0) return table[i]
  }
  return table[0]
}

function readOwn(thisArg) {
  try {
    const own = thisArg ? thisArg.objdataOwn : null
    return own && typeof own === 'object' ? own : null
  } catch (err) { return null }
}

function isFooding(thisArg) {
  try { return thisArg && thisArg.fooding === true } catch (err) { return false }
}

/** 引擎里 Plant 实例的 this.ID 就是 PlantFeatures 的 ID */
function plantId(thisArg) {
  try {
    const id = thisArg ? thisArg.ID : null
    if (typeof id === 'number') return id
  } catch (err) { /* 读不到就不干预 */ }
  return null
}

function withArg(args, index, value) {
  const next = Array.prototype.slice.call(args)
  while (next.length <= index) next.push(undefined)
  next[index] = value
  return next
}

/** 临时换掉 objdataOwn 的某个字段 → 放行 → 还原 */
function withSwappedType(thisArg, key, type, callNext, args, onSwap) {
  const own = readOwn(thisArg)
  if (!own) return callNext(...args)

  let previous
  let patched = false
  try {
    previous = own[key]
    own[key] = type
    patched = own[key] === type
  } catch (err) {
    patched = false
  }

  if (patched && typeof onSwap === 'function') {
    try { onSwap(type) } catch (err) { /* 统计失败不影响发射 */ }
  }

  try {
    return callNext(...args)
  } finally {
    if (patched) {
      try { own[key] = previous } catch (err) { /* 还原失败不影响本次发射 */ }
    }
  }
}

// ═══════════════════════ A. 元素豌豆配置 ═══════════════════════

const ELEMENTAL_TABLE = [
  { type: 'pea', weight: 35, label: '普通豌豆' },
  { type: 'pea_snow', weight: 15, label: '寒冰豌豆' },
  { type: 'pea_flame_yellow', weight: 15, label: '火焰豌豆' },
  { type: 'pea_goo', weight: 15, label: '毒液豌豆' },
  { type: 'electricpea', weight: 10, label: '电能豌豆' },
  { type: 'pea_primal', weight: 10, label: '原始豌豆' },
]
const ELEMENTAL_TOTAL = ELEMENTAL_TABLE.reduce((sum, e) => sum + e.weight, 0)

/** 真正会发射的动画事件名；Shoot5 需要 upgraded 才发射 */
const ELEMENTAL_FIRE = 'Shoot'
const ELEMENTAL_FIRE5 = 'Shoot5'

// ═══════════════════════ B. 融合大哥配置 ═══════════════════════

/** MGP 植物 ID（取自 0.15.0 PlantFeatures.json，用来把钩子卡死在融合株上） */
const MGP_ID = {
  primalpeashooter: 220,
  threepeater: 222,
  repeater: 224,
  splitpea: 225,
  slingpea: 226,
  seashooter: 228,
}

/** 四株大招的冰火豆配比 */
const FOOD_MIX = [
  { type: 'pea', weight: 50, label: '普豆' },
  { type: 'pea_snow', weight: 25, label: '冰豆' },
  { type: 'pea_flame_yellow', weight: 25, label: '火豆' },
]

/** 超级军炮大招的三弹种配比 */
const SLING_MIX = [
  { type: 'pea_primal', weight: 60, label: '原豌子弹' },
  { type: 'akee', weight: 35, label: 'AKEE 弹跳' },
  { type: 'coconut', weight: 5, label: '椰子炸弹' },
]

/** 超级原豌：只改普攻，大招不动 */
const PRIMAL = {
  meteorChance: 0.1,
  meteorType: 'meteor',
}

// ═══════════════════════ C. 大哥 BGM 配置 ═══════════════════════

const BGM = {
  /**
   * 包内资源候选路径，按顺序尝试，第一个读得到的生效。
   * 这样本地生成 / 导出的音频不管是什么格式，丢进 audio/ 就能直接用，不必先转码。
   */
  assetPaths: [
    'audio/mega-gatling-bgm.ogg',
    'audio/mega-gatling-bgm.oga',
    'audio/mega-gatling-bgm.mp3',
    'audio/mega-gatling-bgm.m4a',
    'audio/mega-gatling-bgm.wav',
  ],
  /** 淡入淡出秒数，模拟引擎自己的 1/60 渐变手感 */
  fadeSeconds: 0.35,
  /** 检查间隔（真实毫秒）—— 用 runtime 定时器，暂停和结算时不中断 */
  pollMs: 100,
  /**
   * 大哥系名单：megagatling 本体 + PlantFeatures.json 里 megagatling 的 SubPlantList。
   * 名单来源是游戏数据，不是推测。
   */
  family: [
    'megagatling',
    'repeater_mgp',
    'threepeater_mgp',
    'splitpea_mgp',
    'peapod_mgp',
    'electricpeashooter_mgp',
    'poisonpeashooter_mgp',
    'seashooter_mgp',
    'firepeashooter_mgp',
    'snowpea_mgp',
    'primalpeashooter_mgp',
    'shadowpeashooter_mgp',
    'slingpea_mgp',
    'snappea_mgp',
    'skyshooter_mgp',
    'gatling_mgp',
  ],
}

// ═══════════════════════ D. BGM 期间的全场攻速增益 ═══════════════════════

/**
 * 大哥 BGM 接管期间，全场植物的攻击速度获得加成。
 *
 * ── 为什么用 _cdScale 而不是自己改 ShootInterval ──
 * 引擎里攻击间隔一律这样算：
 *     shootCD = (ShootInterval + ShootIntervalAdditional * random) * this._cdScale
 * 而 _cdScale 是个 getter：
 *     get _cdScale() { return this._cdScaleByPlant * this._cdScaleFightAlone }
 * 配套的 plantCDScaleSetter(value, seconds) 会写入 _cdScaleByPlant 并起一个
 * 倒计时（_cdScaleByPlantCD），到点自动把 _cdScaleByPlant 复位成 1。
 *
 * 也就是说「限时攻速缩放」本来就是引擎自带的能力，本模组直接借用：
 * 每帧给植物续期一次，退出接管后不再续期，1 秒内自然回正 —— 零副作用、自动过期，
 * 也不必去动 ShootingInterval 这类原始数值。
 *
 * 注意倍率方向：_cdScale 乘在「间隔」上，所以要得到「攻速 +bonus」，
 * 应当写入 1 / (1 + bonus)。
 */
const ATTACK_SPEED = {
  /** 场上每多一株大哥，攻击速度 +10% */
  perPlant: 0.10,
  /** 加成上限 +30%（即 3 株及以上封顶） */
  max: 0.30,
  /** 续期秒数：略大于一个心跳周期即可，退出后自然过期 */
  refresher: 1,
}

/** 当前该写入植物的 _cdScale 值；1 表示不加成 */
function currentCdScale() {
  if (!bgmState.owned) return 1
  const bonus = Math.min(ATTACK_SPEED.max, ATTACK_SPEED.perPlant * bgmState.alive)
  if (!(bonus > 0)) return 1
  return 1 / (1 + bonus)
}

/** 当前的攻速加成百分比（用于面板显示） */
function currentAttackBonus() {
  const scale = currentCdScale()
  return scale >= 1 ? 0 : (1 / scale - 1)
}

/**
 * 让玩家看得见加成生效 / 失效。
 * 面板不算反馈——没人在战斗中开面板，所以这里用一次性提示。
 */
function notifyBoost(on, ctx) {
  try {
    const ui = ctx && ctx.ui
    if (!ui || typeof ui.toast !== 'function') return
    if (on) {
      const pct = Math.round(currentAttackBonus() * 100)
      ui.toast(pct > 0 ? `大哥 BGM 接管 · 全场攻速 +${pct}%` : '大哥 BGM 接管', 'success')
    } else {
      ui.toast('大哥离场 · 攻速加成解除', 'info')
    }
  } catch (err) { /* 提示失败不影响功能 */ }
}

/** 只有这些阶段算「战斗中」，才可能播大哥 BGM */
const LIVE_PHASES = ['running', 'paused']
/** 这些阶段一律交还引擎（胜利 / 失败 / 结算 / 通关） */
const END_PHASES = ['won', 'lost', 'ended']

// ═══════════════════════ 运行期状态 ═══════════════════════

const resolved = new Map()
const attached = new Map()

const stats = {
  elementalShots: 0,
  foodMix: 0,
  slingMix: 0,
  meteorNormal: 0,
}
const elementalFired = new Map()

/** 攻速增益的运行状态（面板显示用） */
const boostState = { applied: 0, lastScale: 1 }

let musicCtrl = null
let entityMode = 'unknown'

const bgmState = {
  loaded: false,
  assetPath: '(未加载)',
  bytes: 0,
  loadError: '',
  el: null,
  url: null,
  owned: false,
  playing: false,
  scale: 1,
  /** 已把音乐标量交还引擎，不再写入（避免交还后每帧空转） */
  handedOff: true,
  phase: '(未读取)',
  alive: 0,
  plays: 0,
  stops: 0,
  lastReason: '尚未进入战斗',
}

// ═══════════════════════ 类定位 ═══════════════════════

function locateClass(engine, clsName, modulePath) {
  if (!engine) return null
  try {
    const cc = typeof engine.getCc === 'function' ? engine.getCc() : null
    const got = cc && cc.js && cc.js.getClassByName ? cc.js.getClassByName(clsName) : null
    if (typeof got === 'function') return { cls: got, how: 'cc.js' }
  } catch (err) { note(clsName + ': cc.js 抛错 ' + errText(err)) }
  try {
    const got = typeof engine.getClassByName === 'function' ? engine.getClassByName(clsName) : null
    if (typeof got === 'function') return { cls: got, how: 'engine' }
  } catch (err) { note(clsName + ': getClassByName 抛错 ' + errText(err)) }
  try {
    const got = typeof engine.getModuleExport === 'function' ? engine.getModuleExport(modulePath, clsName) : null
    if (typeof got === 'function') return { cls: got, how: 'module' }
  } catch (err) { note(clsName + ': getModuleExport 抛错 ' + errText(err)) }
  return null
}

/**
 * 挂载计划。
 * A 组的类必须用 module 路径兜底（MegaGatlingPeaPlant 一定在 MegaGatlingPea.ts 里）；
 * B 组用父类原型 + ID 白名单，普通同名植物零影响。
 */
const PLAN = [
  { key: 'elemental', group: 'A', cls: 'MegaGatlingPeaPlant', module: 'chunks:///_virtual/MegaGatlingPea.ts', method: 'animationListener', label: '超级机枪射手·元素弹' },
  { key: 'foodDec', group: 'B', cls: 'PeashooterPlant', module: 'chunks:///_virtual/Peashooter.ts', method: 'onFoodLeftPeaCountDec', label: '双发/海豌豆·大招混弹' },
  { key: 'split', group: 'B', cls: 'SplitPeaPlant', module: 'chunks:///_virtual/SplitPea.ts', method: 'onFoodLeftPeaCountDec', label: '裂荚·大招混弹' },
  { key: 'splitBack', group: 'B', cls: 'SplitPeaPlant', module: 'chunks:///_virtual/SplitPea.ts', method: '_shootBack', label: '裂荚背面·大招混弹' },
  { key: 'three', group: 'B', cls: 'ThreePeaterPlant', module: 'chunks:///_virtual/ThreePeater.ts', method: '_shoot3', label: '三线·大招混弹' },
  { key: 'sling', group: 'B', cls: 'SlingPeaPlant', module: 'chunks:///_virtual/SlingPea.ts', method: 'animationListener', label: '军炮·大招三弹种' },
  { key: 'primalShoot', group: 'B', cls: 'PrimalPeashooterPlant', module: 'chunks:///_virtual/PrimalPeashooter.ts', method: 'animationListener', label: '超级原豌·普攻流星' },
  { key: 'plantCd', group: 'D', cls: 'Plant', module: 'chunks:///_virtual/Plant.ts', method: 'characterUpdate', label: '全场攻速增益' },
]

// ═══════════════════════ A 组：元素豌豆钩子 ═══════════════════════

function makeElementalHandler() {
  return function ({ thisArg, args, callNext }) {
    const eventName = args[0] && args[0].name
    if (eventName !== ELEMENTAL_FIRE && eventName !== ELEMENTAL_FIRE5) return callNext(...args)

    let willFire = true
    if (eventName === ELEMENTAL_FIRE5) {
      try { willFire = thisArg.upgraded === true } catch (err) { willFire = false }
    }

    const own = readOwn(thisArg)
    if (!own) return callNext(...args)

    let previous
    let chosen
    let patched = false
    try {
      previous = own.PeaType
      chosen = pick(ELEMENTAL_TABLE).type
      own.PeaType = chosen
      patched = own.PeaType === chosen
    } catch (err) {
      patched = false
    }

    if (patched && willFire) {
      stats.elementalShots += 1
      elementalFired.set(chosen, (elementalFired.get(chosen) || 0) + 1)
    }

    try {
      return callNext(...args)
    } finally {
      if (patched) {
        try { own.PeaType = previous } catch (err) { /* 还原失败不影响本次发射 */ }
      }
    }
  }
}

// ═══════════════════════ B 组：融合大哥钩子 ═══════════════════════

/** 双发 / 海豌豆正面大招：基类 onFoodLeftPeaCountDec 里固定读 PeaTypePlantfood */
function makeFoodCountDecHandler(kinds) {
  const ids = kinds.map((k) => MGP_ID[k]).filter((v) => typeof v === 'number')
  return function ({ thisArg, args, callNext }) {
    if (ids.indexOf(plantId(thisArg)) < 0) return callNext(...args)
    if (!isFooding(thisArg)) return callNext(...args)
    const chosen = pick(FOOD_MIX)
    return withSwappedType(thisArg, 'PeaTypePlantfood', chosen.type, callNext, args, () => { stats.foodMix += 1 })
  }
}

/** 裂荚背面（含收尾一发）：_shootBack(noSound, forceNoSound, peaType) */
function splitBackHandler({ thisArg, args, callNext }) {
  if (plantId(thisArg) !== MGP_ID.splitpea) return callNext(...args)
  if (!isFooding(thisArg)) return callNext(...args)
  const chosen = pick(FOOD_MIX)
  stats.foodMix += 1
  return callNext(...withArg(args, 2, chosen.type))
}

/** 三线：大招期间反复调用的 _shoot3(lane, velocity, peaType) */
function threepeaterHandler({ thisArg, args, callNext }) {
  if (plantId(thisArg) !== MGP_ID.threepeater) return callNext(...args)
  if (!isFooding(thisArg)) return callNext(...args)
  const chosen = pick(FOOD_MIX)
  stats.foodMix += 1
  return callNext(...withArg(args, 2, chosen.type))
}

/** 超级军炮大招：animationListener 的 "shoot" 分支 */
function makeSlingHandler() {
  return function ({ thisArg, args, callNext }) {
    const eventName = args[0] && args[0].name
    if (eventName !== 'shoot') return callNext(...args)
    if (plantId(thisArg) !== MGP_ID.slingpea) return callNext(...args)
    if (!isFooding(thisArg)) return callNext(...args)
    const chosen = pick(SLING_MIX)
    return withSwappedType(thisArg, 'PeaTypePlantfood', chosen.type, callNext, args, () => { stats.slingMix += 1 })
  }
}

/** 超级原豌普攻 10% 换成流星；大招一律放行原版 */
function makePrimalShootHandler() {
  return function ({ thisArg, args, callNext }) {
    const eventName = args[0] && args[0].name
    if (eventName !== 'Shoot') return callNext(...args)
    if (plantId(thisArg) !== MGP_ID.primalpeashooter) return callNext(...args)
    if (isFooding(thisArg)) return callNext(...args)
    try {
      if (Math.random() < PRIMAL.meteorChance) {
        stats.meteorNormal += 1
        return withSwappedType(thisArg, 'PeaType', PRIMAL.meteorType, callNext, args, null)
      }
    } catch (err) {
      note('流星替换异常: ' + errText(err))
    }
    return callNext(...args)
  }
}

/**
 * 全场攻速增益：借引擎自带的 _cdScale 限时缩放，每帧续期一次。
 * 放在 callNext 之后，绝不干扰植物本帧原本的逻辑。
 *
 * ⚠️ 挂载点必须是 Plant.prototype.characterUpdate，不能是 specialPlantUpdate。
 * 后者被 96 个植物模块各自覆写（Aloe / Anthurium / … / ZoybeanPod），
 * 挂在基类上等于没挂——子类覆写之后根本走不到基类实现。
 * characterUpdate 则没有被子类覆写，是唯一每帧对所有植物都执行的入口。
 */
function makePlantCdHandler() {
  return function ({ thisArg, args, callNext }) {
    const result = callNext(...args)
    try {
      if (bgmState.owned && thisArg && typeof thisArg.plantCDScaleSetter === 'function') {
        const scale = currentCdScale()
        if (scale < 1) {
          thisArg.plantCDScaleSetter(scale, ATTACK_SPEED.refresher)
          boostState.applied += 1
          boostState.lastScale = scale
        }
      }
    } catch (err) { /* 攻速增益失败绝不影响植物本身 */ }
    return result
  }
}

function handlerFor(key) {
  switch (key) {
    case 'elemental': return makeElementalHandler()
    case 'foodDec': return makeFoodCountDecHandler(['repeater', 'seashooter'])
    case 'split': return makeFoodCountDecHandler(['splitpea'])
    case 'splitBack': return splitBackHandler
    case 'three': return threepeaterHandler
    case 'sling': return makeSlingHandler()
    case 'primalShoot': return makePrimalShootHandler()
    case 'plantCd': return makePlantCdHandler()
    default: return null
  }
}

// ═══════════════════════ C 组：大哥 BGM 引擎 ═══════════════════════

function readMusicVolume() {
  try {
    if (musicCtrl && typeof musicCtrl.MusicVolume === 'number') return clamp01(musicCtrl.MusicVolume)
  } catch (err) { /* 读不到按满音量 */ }
  return 1
}

/** 按扩展名推断 Blob MIME，别写死 audio/ogg —— 素材换成 mp3 就放不出来了 */
function mimeForPath(p) {
  const s = String(p || '').toLowerCase()
  if (s.endsWith('.mp3')) return 'audio/mpeg'
  if (s.endsWith('.m4a') || s.endsWith('.aac')) return 'audio/mp4'
  if (s.endsWith('.wav')) return 'audio/wav'
  if (s.endsWith('.flac')) return 'audio/flac'
  return 'audio/ogg'
}

/** 建一个 HTML5 Audio 播放器；环境不支持时返回 null，走降级路径 */
function createAudioElement(bytes, path) {
  const doc = typeof document !== 'undefined' ? document : null
  const UrlC = typeof URL !== 'undefined' ? URL : null
  const BlobC = typeof Blob !== 'undefined' ? Blob : null
  if (!doc || typeof doc.createElement !== 'function') return null
  if (!UrlC || typeof UrlC.createObjectURL !== 'function') return null
  if (!BlobC) return null
  try {
    const blob = new BlobC([bytes], { type: mimeForPath(path) })
    const url = UrlC.createObjectURL(blob)
    const el = doc.createElement('audio')
    el.src = url
    el.loop = true
    el.preload = 'auto'
    el.volume = readMusicVolume()
    bgmState.url = url
    return el
  } catch (err) {
    bgmState.loadError = '创建播放器失败: ' + errText(err)
    return null
  }
}

async function loadBgmAsset(ctx) {
  try {
    if (!ctx || !ctx.files || typeof ctx.files.own !== 'function') {
      bgmState.loadError = 'ctx.files.own 不可用'
      note('BGM：' + bgmState.loadError)
      return
    }
    const own = ctx.files.own()
    const paths = BGM.assetPaths && BGM.assetPaths.length ? BGM.assetPaths : ['audio/mega-gatling-bgm.ogg']
    let lastErr = ''

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i]
      let bytes = null
      try {
        bytes = await own.readBytes(path)
      } catch (err) {
        lastErr = path + ' 读取抛错: ' + errText(err)
        continue
      }
      if (!bytes || !bytes.length) {
        lastErr = '未找到 ' + path
        continue
      }

      bgmState.assetPath = path
      bgmState.bytes = bytes.length
      const el = createAudioElement(bytes, path)
      if (!el) {
        if (!bgmState.loadError) bgmState.loadError = '当前环境没有可用的 HTML5 Audio'
        note('BGM：' + bgmState.loadError)
        return
      }
      bgmState.el = el
      bgmState.loaded = true
      bgmState.loadError = ''
      note(`BGM：资源已加载 ${bytes.length} 字节（${path}，${mimeForPath(path)}）`)
      return
    }

    bgmState.loadError = lastErr || '候选路径都读不到'
    note('BGM：' + bgmState.loadError)
  } catch (err) {
    bgmState.loadError = errText(err)
    note('BGM：加载异常 ' + bgmState.loadError)
  }
}

function playGatlingBgm() {
  bgmState.plays += 1
  if (!bgmState.loaded || !bgmState.el) return
  try {
    bgmState.el.volume = readMusicVolume()
    const p = bgmState.el.play()
    if (p && typeof p.then === 'function') {
      bgmState.playing = true
      p.then(() => { bgmState.playing = true })
        .catch((err) => {
          bgmState.playing = false
          bgmState.loadError = 'play 被拒绝: ' + errText(err)
          note('BGM：' + bgmState.loadError)
        })
    } else {
      bgmState.playing = true
    }
  } catch (err) {
    bgmState.loadError = errText(err)
    note('BGM：播放异常 ' + errText(err))
  }
}

function stopGatlingBgm() {
  bgmState.stops += 1
  if (!bgmState.el) return
  try {
    bgmState.el.pause()
    bgmState.el.currentTime = 0
  } catch (err) { /* 停不掉也不影响交还音量 */ }
  bgmState.playing = false
}

/** 读实体 codename：多路探测，读不到就返回 null 让调用方切换查询模式 */
function readCodename(entity) {
  if (!entity) return null
  try {
    if (typeof entity.codename === 'string' && entity.codename) return entity.codename
    if (typeof entity.getCodename === 'function') {
      const c = entity.getCodename()
      if (typeof c === 'string' && c) return c
    }
    if (typeof entity.snapshot === 'function') {
      const s = entity.snapshot()
      if (s) {
        if (typeof s.codename === 'string' && s.codename) return s.codename
        if (typeof s.CODENAME === 'string' && s.CODENAME) return s.CODENAME
        if (s.feature && typeof s.feature.CODENAME === 'string') return s.feature.CODENAME
      }
    }
  } catch (err) { /* 读不到 */ }
  return null
}

/** 统计场上存活的大哥系植物数量 */
function countFamily(ctx) {
  const names = BGM.family

  if (entityMode !== 'perCodename') {
    try {
      const all = ctx.entities.list({ kind: 'plant', alive: true })
      if (Array.isArray(all)) {
        let hits = 0
        let readable = 0
        for (let i = 0; i < all.length; i++) {
          const cn = readCodename(all[i])
          if (cn) readable += 1
          if (cn && names.indexOf(cn) >= 0) hits += 1
        }
        // 拿得到 codename → 本地筛；一个都读不到 → 改用逐 codename 查询
        if (all.length === 0 || readable > 0) {
          entityMode = 'local'
          return hits
        }
        entityMode = 'perCodename'
        note('实体读不到 codename，改用逐 codename 查询')
      }
    } catch (err) {
      entityMode = 'perCodename'
      note('entities.list 全量查询失败，改用逐 codename 查询: ' + errText(err))
    }
  }

  let hits = 0
  for (let i = 0; i < names.length; i++) {
    try {
      const r = ctx.entities.list({ kind: 'plant', alive: true, codename: names[i] })
      if (Array.isArray(r)) hits += r.length
    } catch (err) { /* 单个 codename 查不动就跳过 */ }
  }
  return hits
}

/** 分级读游戏阶段；读不到返回空串 */
function readPhase(ctx) {
  try {
    const st = ctx.game && typeof ctx.game.getState === 'function' ? ctx.game.getState() : null
    if (st && typeof st.phase === 'string') return st.phase
  } catch (err) { /* 读不到 */ }
  return ''
}

/**
 * 把音乐音量标量写回引擎。
 * 必须先写完"交还后的 1"再停手 —— 提前 return 会把引擎音乐永久冻在 0。
 */
function writeVolumeScale() {
  if (!musicCtrl || bgmState.handedOff) return
  try { musicCtrl._volumeScalePause = bgmState.scale } catch (err) { /* 写不进去就退化为不静音 */ }
  if (!bgmState.owned && bgmState.scale >= 1) bgmState.handedOff = true
}

/**
 * 主循环（真实时间 100ms 一次）。
 * 用 runtime 定时器而不是 clock.onTick：暂停、结算、胜负界面期间都还在跑，
 * 这样才能保证「游戏结束时换回原 BGM」一定会被触发。
 */
function bgmPulse(ctx, dt) {
  // 1) 实体计数（节流：每 2 次心跳查一次，即 200ms）
  if (!bgmPulse._skip || bgmPulse._skip <= 0) {
    bgmPulse._skip = 1
    try { bgmState.alive = countFamily(ctx) } catch (err) { bgmState.alive = 0 }
  } else {
    bgmPulse._skip -= 1
  }

  // 2) 该不该播
  const phase = readPhase(ctx)
  if (phase) bgmState.phase = phase
  const inBattle = LIVE_PHASES.indexOf(bgmState.phase) >= 0
  const ended = END_PHASES.indexOf(bgmState.phase) >= 0

  let want = inBattle && bgmState.alive > 0 && bgmState.loaded
  if (ended) want = false

  if (ended) bgmState.lastReason = '关卡已结束（' + bgmState.phase + '），交还原 BGM'
  else if (!inBattle) bgmState.lastReason = '当前阶段 ' + bgmState.phase + '，不接管'
  else if (bgmState.alive <= 0) bgmState.lastReason = '场上没有存活的大哥系植物'
  else if (!bgmState.loaded) bgmState.lastReason = '有 ' + bgmState.alive + ' 株大哥，但 BGM 素材不可用，保持原 BGM'
  else bgmState.lastReason = '场上存活 ' + bgmState.alive + ' 株大哥，接管中'

  // 3) 状态切换
  if (want && !bgmState.owned) {
    bgmState.owned = true
    bgmState.handedOff = false
    boostState.applied = 0
    playGatlingBgm()
    note('BGM：开始接管（' + bgmState.lastReason + '）')
    notifyBoost(true, ctx)
  } else if (!want && bgmState.owned) {
    bgmState.owned = false
    stopGatlingBgm()
    note('BGM：交还引擎（' + bgmState.lastReason + '）')
    notifyBoost(false, ctx)
  }

  // 4) 音量标量渐变：接管期间压到 0，交还后升回 1
  const target = bgmState.owned ? 0 : 1
  if (bgmState.scale !== target) {
    const step = dt / Math.max(0.05, BGM.fadeSeconds)
    bgmState.scale = target > bgmState.scale
      ? Math.min(target, bgmState.scale + step)
      : Math.max(target, bgmState.scale - step)
  }
  writeVolumeScale()

  // 5) 自带播放器跟随游戏设置里的音乐音量
  if (bgmState.playing && bgmState.el) {
    try { bgmState.el.volume = readMusicVolume() } catch (err) { /* 忽略 */ }
  }
}

// ═══════════════════════ 面板 ═══════════════════════

function describeElemental(entry) {
  const hits = elementalFired.get(entry.type) || 0
  const pct = stats.elementalShots > 0 ? ((hits / stats.elementalShots) * 100).toFixed(1) : '0.0'
  return `${hits} 发 · ${pct}%`
}

function dumpDiagnostics(ctx) {
  try {
    ctx.log.info('[JBTMG] ---- 诊断 ----')
    for (let i = 0; i < diagLines.length; i++) ctx.log.info('[JBTMG] ' + diagLines[i])
    ctx.log.info('[JBTMG] 挂载:' + Object.keys(attached).map((k) => k + '=' + attached.get(k)).join(' '))
    ctx.log.info('[JBTMG] ' + bgmStatusLine())
    ctx.log.info('[JBTMG] ---- 诊断结束 ----')
  } catch (err) { /* 静默 */ }
}

function bgmStatusLine() {
  if (!bgmState.loaded) return 'BGM 未就绪：' + (bgmState.loadError || '资源尚未加载')
  return `BGM ${bgmState.owned ? '接管中' : '未接管'} · 存活 ${bgmState.alive} · 标量 ${bgmState.scale.toFixed(2)} · ${bgmState.lastReason}`
}

function definePanel(ctx) {
  try {
    const groups = [
      {
        title: '大哥 BGM',
        items: [
          { type: 'readonly', key: 'b-asset', label: '资源', getValue: () => (bgmState.loaded ? `${bgmState.assetPath}（${bgmState.bytes} 字节）` : (bgmState.loadError || '加载中…')) },
          { type: 'readonly', key: 'b-state', label: '接管状态', getValue: () => (bgmState.owned ? '接管中（引擎音乐已静音）' : '未接管') },
          { type: 'readonly', key: 'b-reason', label: '当前判定', getValue: () => bgmState.lastReason },
          { type: 'readonly', key: 'b-alive', label: '存活大哥', getValue: () => String(bgmState.alive) },
          { type: 'readonly', key: 'b-phase', label: '游戏阶段', getValue: () => bgmState.phase },
          { type: 'readonly', key: 'b-scale', label: '音乐音量标量', getValue: () => bgmState.scale.toFixed(2) },
          { type: 'readonly', key: 'b-count', label: '播/停次数', getValue: () => `${bgmState.plays} / ${bgmState.stops}` },
          { type: 'readonly', key: 'b-boost', label: '全场攻速加成', getValue: () => (currentAttackBonus() > 0 ? `+${(currentAttackBonus() * 100).toFixed(0)}%` : '无') },
          { type: 'readonly', key: 'b-cdhook', label: '攻速钩子', getValue: () => attached.get('plantCd') || '未挂载' },
          { type: 'readonly', key: 'b-cdn', label: '攻速续期次数', getValue: () => String(boostState.applied) },
        ],
      },
      {
        title: '元素豌豆 · 挂载与分布',
        items: [
          { type: 'readonly', key: 'a-hook', label: '挂载点', getValue: () => attached.get('elemental') || '未挂载' },
          { type: 'readonly', key: 'a-shots', label: '累计发射', getValue: () => String(stats.elementalShots) },
        ].concat(ELEMENTAL_TABLE.map((entry) => ({
          type: 'readonly',
          key: 'a-dist-' + entry.type,
          label: `${entry.label}（目标 ${entry.weight}%）`,
          getValue: () => describeElemental(entry),
        }))),
      },
      {
        title: '融合大哥 · 挂载与计数',
        items: [
          { type: 'readonly', key: 'f-food', label: '双发/海豌豆·大招混弹', getValue: () => attached.get('foodDec') || '未挂载' },
          { type: 'readonly', key: 'f-split', label: '裂荚·大招混弹', getValue: () => attached.get('split') || '未挂载' },
          { type: 'readonly', key: 'f-splitb', label: '裂荚背面', getValue: () => attached.get('splitBack') || '未挂载' },
          { type: 'readonly', key: 'f-three', label: '三线·大招混弹', getValue: () => attached.get('three') || '未挂载' },
          { type: 'readonly', key: 'f-sling', label: '军炮·大招三弹种', getValue: () => attached.get('sling') || '未挂载' },
          { type: 'readonly', key: 'f-primal', label: '超级原豌·普攻流星', getValue: () => attached.get('primalShoot') || '未挂载' },
          { type: 'readonly', key: 'f-c-food', label: '大招混弹（冰火豆）', getValue: () => String(stats.foodMix) },
          { type: 'readonly', key: 'f-c-sling', label: '军炮大招三弹种', getValue: () => String(stats.slingMix) },
          { type: 'readonly', key: 'f-c-meteor', label: '普攻流星', getValue: () => String(stats.meteorNormal) },
        ],
      },
      {
        title: '操作',
        items: [
          {
            type: 'action',
            key: 'diag',
            label: '输出诊断到日志',
            onClick: () => { dumpDiagnostics(ctx); ctx.ui.toast('诊断已写入日志', 'info') },
          },
          {
            type: 'action',
            key: 'reset',
            label: '清零统计',
            onClick: () => {
              stats.elementalShots = 0
              stats.foodMix = 0
              stats.slingMix = 0
              stats.meteorNormal = 0
              elementalFired.clear()
              bgmState.plays = 0
              bgmState.stops = 0
              ctx.ui.toast('统计已清零', 'info')
            },
          },
        ],
      },
    ]

    ctx.controls.definePanel({
      title: 'Just Better Than Mega Gatling',
      description: '整合元素豌豆 + 融合大哥，并在大哥系存活期间用自带 BGM 顶替关卡音乐。',
      groups,
    })
  } catch (err) {
    try { ctx.log.warn('[JBTMG] 面板创建失败：' + errText(err)) } catch (inner) { /* 静默 */ }
  }
}

// ═══════════════════════ 钩子挂载 ═══════════════════════

function guard(rawHandler) {
  return function ({ thisArg, args, callNext }) {
    let nextCalled = false
    const safeNext = function (...a) { nextCalled = true; return callNext(...a) }
    try {
      return rawHandler({ thisArg, args, callNext: safeNext })
    } catch (err) {
      note('钩子异常（已按原版放行）: ' + errText(err))
      if (!nextCalled) return callNext(...args)
      return undefined
    }
  }
}

function wrap(ctx, target, methodName, handler, label) {
  if (!target || typeof target[methodName] !== 'function') {
    note(`${label}: 目标原型上没有 ${methodName}`)
    return false
  }
  ctx.unsafe.hooks.wrapMethod({ target, methodName, handler: guard(handler) })
  return true
}

function installAll(ctx) {
  for (const item of PLAN) {
    const found = resolved.get(item.key)
    if (!found) { attached.set(item.key, '未找到类'); continue }
    let handler
    try {
      handler = handlerFor(item.key)
    } catch (err) {
      note(item.key + ': handler 构造失败 ' + errText(err))
      attached.set(item.key, 'handler 构造失败')
      continue
    }
    if (!handler) { attached.set(item.key, '缺少 handler'); continue }
    const ok = wrap(ctx, found.cls.prototype, item.method, handler, item.key)
    attached.set(item.key, ok ? item.method : 'failed')
  }
}

// ═══════════════════════ 生命周期 ═══════════════════════

export default {
  startup(ctx) {
    try {
      if (!ctx || !ctx.engine) { note('startup: ctx.engine 不可用'); return }
      note('engine 上的方法: ' + safeKeys(ctx.engine))

      for (const item of PLAN) {
        const found = locateClass(ctx.engine, item.cls, item.module)
        if (found) resolved.set(item.key, found)
        else note(`${item.cls} 未定位`)
      }

      // MusicController 不在 cc 类表里（不是 Component），只能走模块导出
      if (!musicCtrl) {
        const got = locateClass(ctx.engine, 'MusicController', 'chunks:///_virtual/SoundsController.ts')
        if (got) {
          musicCtrl = got.cls
          note('MusicController 已定位（via ' + got.how + '）')
        } else {
          note('MusicController 未定位，BGM 覆盖将无法静音引擎音乐')
        }
      }

      ctx.log.info(`[JBTMG] startup 定位 ${resolved.size}/${PLAN.length} 个挂载点，MusicController=${musicCtrl ? 'ok' : 'miss'}`)
    } catch (err) {
      note('startup 顶层异常: ' + errText(err))
      try { ctx.log.error('[JBTMG] startup 异常：' + errText(err)) } catch (inner) { /* 静默 */ }
    }
  },

  setup(ctx) {
    try {
      if (!ctx || !ctx.unsafe || !ctx.unsafe.hooks || typeof ctx.unsafe.hooks.wrapMethod !== 'function') {
        note('setup: 没有可用的 unsafe.hooks.wrapMethod')
        try { ctx.log.error('[JBTMG] 没有可用的 unsafe.hooks.wrapMethod，全部改动不会生效'); dumpDiagnostics(ctx) } catch (inner) { /* 静默 */ }
        return
      }

      if (resolved.size === 0) {
        const pools = [ctx.unsafe, ctx.advanced]
        for (const pool of pools) {
          const engine = pool && (pool.engine || (typeof pool.getClassByName === 'function' ? pool : null))
          if (!engine) continue
          for (const item of PLAN) {
            const found = locateClass(engine, item.cls, item.module)
            if (found) resolved.set(item.key, found)
          }
          if (!musicCtrl) {
            const got = locateClass(engine, 'MusicController', 'chunks:///_virtual/SoundsController.ts')
            if (got) musicCtrl = got.cls
          }
          break
        }
      }

      installAll(ctx)

      let hooked = 0
      const failed = []
      for (const item of PLAN) {
        const st = attached.get(item.key)
        if (st && st !== 'failed' && st !== '未找到类' && st !== '缺少 handler' && st !== 'handler 构造失败') hooked += 1
        else failed.push(item.cls + '.' + item.method)
      }

      ctx.log.info(`[JBTMG] 已挂载 ${hooked}/${PLAN.length} 组（MGP ID 白名单: ${Object.values(MGP_ID).join(',')}）`)
      if (failed.length) { note('未挂载：' + failed.join('、')) }
      if (!musicCtrl) note('MusicController 缺失 → BGM 覆盖只播自带音乐，无法静音引擎原 BGM')

      // BGM 资源异步加载，不阻塞 setup
      try {
        const p = loadBgmAsset(ctx)
        if (p && typeof p.then === 'function' && ctx.runtime && typeof ctx.runtime.track === 'function') ctx.runtime.track(p)
      } catch (err) {
        bgmState.loadError = errText(err)
        note('BGM 预加载异常: ' + bgmState.loadError)
      }

      // 主循环：真实时间，暂停 / 结算期间照样跑
      try {
        if (ctx.runtime && typeof ctx.runtime.setInterval === 'function') {
          ctx.runtime.setInterval(() => {
            try { bgmPulse(ctx, BGM.pollMs / 1000) } catch (err) { note('BGM 心跳异常: ' + errText(err)) }
          }, BGM.pollMs)
          note(`BGM 心跳已注册（${BGM.pollMs}ms）`)
        } else {
          note('ctx.runtime.setInterval 不可用，BGM 状态机不会运行')
        }
      } catch (err) {
        note('BGM 心跳注册失败: ' + errText(err))
      }

      if (hooked === 0 && !musicCtrl) {
        ctx.ui.toast('JBTMG：植物钩子与 BGM 均未生效（详见日志）', 'error')
        dumpDiagnostics(ctx)
        return
      }

      ctx.ui.toast(`Just Better Than Mega Gatling 已生效（植物 ${hooked}/${PLAN.length}${musicCtrl ? ' + BGM' : ''}）`, 'success')
      definePanel(ctx)
    } catch (err) {
      try {
        ctx.log.error('[JBTMG] setup 异常：' + errText(err))
        dumpDiagnostics(ctx)
      } catch (inner) { /* 静默 */ }
    }
  },
}

// 供模拟测试读取内部状态（游戏内不会用到这些导出）
export const __test__ = {
  PLAN,
  MGP_ID,
  BGM,
  ATTACK_SPEED,
  ELEMENTAL_TABLE,
  ELEMENTAL_TOTAL,
  FOOD_MIX,
  SLING_MIX,
  PRIMAL,
  stats,
  bgmState,
  boostState,
  attached,
  resolved,
  pick,
  handlerFor,
  mimeForPath,
  currentCdScale,
  currentAttackBonus,
  countFamily,
  readCodename,
  bgmPulse,
  writeVolumeScale,
  getMusicCtrl: () => musicCtrl,
  setMusicCtrl: (c) => { musicCtrl = c },
  resetEntityMode: () => { entityMode = 'unknown' },
}
