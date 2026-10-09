/**
 * C 组（大哥 BGM 状态机）+ D 组（降级与鲁棒性）断言。
 */
import {
  ok, section, makeCtx, FakeEntity, world,
  audioCalls, MusicController, resetRecorder, Plant, OverridingPlant,
} from './harness.mjs'

export async function runBgm({ T, modCtx, entryUrl }) {
  section('C. 大哥 BGM 状态机')

  const pulse = (n) => { for (let i = 0; i < (n || 4); i++) T.bgmPulse(modCtx, 0.5) }

  // 无大哥
  world.plants = [new FakeEntity('peashooter'), new FakeEntity('sunflower')]
  world.phase = 'running'
  pulse()
  ok(T.bgmState.alive === 0, '非大哥植物不计入存活数')
  ok(T.bgmState.owned === false, '无大哥时不接管 BGM')
  ok(MusicController._volumeScalePause === 1, '无大哥时音乐标量为 1（引擎原音量）')
  ok(T.bgmState.scale >= 1, '渐变停在 1')

  // 有大哥
  world.plants = [new FakeEntity('peashooter'), new FakeEntity('megagatling')]
  pulse()
  ok(T.bgmState.alive === 1, '大哥本体计入存活数')
  ok(T.bgmState.owned === true, '有大哥 + running 时接管 BGM')
  ok(MusicController._volumeScalePause === 0, '接管期间引擎音乐标量被压到 0')
  ok(audioCalls.play >= 1, '自带播放器被调起 play()')
  ok(T.bgmState.playing === true, '播放状态为 true')

  // MGP 变体也算大哥系
  world.plants = [new FakeEntity('repeater_mgp'), new FakeEntity('slingpea_mgp')]
  pulse()
  ok(T.bgmState.alive === 2, 'MGP 变体（SubPlantList）计入存活数')
  ok(T.bgmState.owned === true, '只有 MGP 变体时同样接管')

  // 大哥全灭
  world.plants = [new FakeEntity('peashooter')]
  pulse()
  ok(T.bgmState.alive === 0, '大哥全灭后存活数归零')
  ok(T.bgmState.owned === false, '大哥全灭后交还 BGM')
  ok(MusicController._volumeScalePause === 1, '交还后音乐标量回到 1')
  ok(audioCalls.pause >= 1, '自带播放器被 pause()')
  ok(T.bgmState.lastReason.includes('没有存活'), '交还原因正确', T.bgmState.lastReason)

  // 游戏结束（需求核心：结束时必须换回原 BGM）
  for (const ph of ['won', 'lost', 'ended']) {
    world.plants = [new FakeEntity('megagatling')]
    world.phase = ph
    pulse()
    ok(T.bgmState.owned === false, `phase=${ph} 时不接管（即使场上有大哥）`)
    ok(MusicController._volumeScalePause === 1, `phase=${ph} 时音乐标量为 1`)
  }
  ok(T.bgmState.lastReason.includes('已结束'), '结束阶段给出正确原因', T.bgmState.lastReason)

  // 非战斗阶段
  for (const ph of ['outside', 'preparing', 'waiting']) {
    world.plants = [new FakeEntity('megagatling')]
    world.phase = ph
    pulse()
    ok(T.bgmState.owned === false, `phase=${ph} 时不接管`)
  }

  // 结束态优先级高于存活判定
  world.phase = 'lost'
  world.plants = [new FakeEntity('megagatling'), new FakeEntity('gatling_mgp')]
  pulse()
  ok(T.bgmState.owned === false, '结束态压过存活判定')
  ok(T.bgmState.alive === 2, '存活数仍然被统计（供面板显示）')

  // 回到战斗 → 重新接管（可逆）
  world.phase = 'running'
  pulse()
  ok(T.bgmState.owned === true, '回到战斗后重新接管')
  ok(MusicController._volumeScalePause === 0, '重新接管后音乐标量再次为 0')
  ok(T.bgmState.plays >= 2, '播放次数递增', String(T.bgmState.plays))

  // 暂停期间继续接管
  world.phase = 'paused'
  pulse()
  ok(T.bgmState.owned === true, '暂停期间保持接管')

  // 播放器音量跟随游戏设置
  MusicController.MusicVolume = 0.4
  pulse()
  ok(Math.abs(T.bgmState.el.volume - 0.4) < 1e-6, '播放器音量跟随 MusicVolume', String(T.bgmState.el.volume))
  MusicController.MusicVolume = 1
  MusicController._volumeScalePause = 1

  // ─────────────────────── C-2. BGM 期间的全场攻速加成 ───────────────────────

  section('C-2. 全场攻速加成')

  const mkPlant = () => new Plant(1, 'pea')
  const bonusOf = () => T.currentAttackBonus()
  const scaleOf = () => T.currentCdScale()

  // 分档：1 / 2 / 3+ 株大哥
  world.phase = 'running'
  world.plants = [new FakeEntity('megagatling')]
  pulse()
  ok(T.bgmState.owned === true, '接管中（攻速加成的前提）')
  ok(Math.abs(bonusOf() - 0.10) < 1e-9, '1 株大哥 → 攻速 +10%', String(bonusOf()))
  ok(Math.abs(scaleOf() - 1 / 1.10) < 1e-9, '写入植物的 _cdScale = 1 / 1.10', String(scaleOf()))

  world.plants = [new FakeEntity('megagatling'), new FakeEntity('repeater_mgp')]
  pulse()
  ok(Math.abs(bonusOf() - 0.20) < 1e-9, '2 株大哥 → 攻速 +20%', String(bonusOf()))

  world.plants = [
    new FakeEntity('megagatling'),
    new FakeEntity('repeater_mgp'),
    new FakeEntity('threepeater_mgp'),
  ]
  pulse()
  ok(Math.abs(bonusOf() - 0.30) < 1e-9, '3 株大哥 → 攻速 +30%', String(bonusOf()))

  world.plants = [
    new FakeEntity('megagatling'),
    new FakeEntity('repeater_mgp'),
    new FakeEntity('threepeater_mgp'),
    new FakeEntity('splitpea_mgp'),
    new FakeEntity('slingpea_mgp'),
  ]
  pulse()
  ok(Math.abs(bonusOf() - 0.30) < 1e-9, '超过 3 株仍封顶在 +30%', String(bonusOf()))

  // 加成确实写进了植物实例，且方向正确（乘在「间隔」上）
  const boosted = mkPlant()
  boosted.characterUpdate(0.1)
  ok(boosted.cdScaleWrites.length === 1, 'characterUpdate 触发一次续期')
  ok(Math.abs(boosted._cdScaleByPlant - scaleOf()) < 1e-9,
    '植物 _cdScaleByPlant 被写入正确值', String(boosted._cdScaleByPlant))
  ok(Math.abs(boosted._cdScale - scaleOf()) < 1e-9,
    '_cdScale getter 反映加成（间隔缩短）', String(boosted._cdScale))
  ok(boosted._cdScale < 1, '倍率小于 1 —— 间隔是乘数，不能写反')

  // 回归：真实植物自己覆写 specialPlantUpdate（引擎里 96 个模块都这么干），
  // 覆写它不影响基类 characterUpdate，增益必须照样生效。
  const overriding = new OverridingPlant(1, 'pea')
  overriding.characterUpdate(0.1)
  ok(overriding.ownUpdateCalls === 1, '子类自己的 specialPlantUpdate 被正常调用')
  ok(overriding.cdScaleWrites.length === 1,
    '覆写 specialPlantUpdate 的植物同样吃到攻速加成（回归）')
  ok(Math.abs(overriding._cdScale - scaleOf()) < 1e-9,
    '覆写者的 _cdScale 也被正确缩短', String(overriding._cdScale))

  // 续期是「每帧刷新」，倒计时不会被耗尽
  for (let i = 0; i < 60; i++) boosted.characterUpdate(0.016)
  ok(Math.abs(boosted._cdScale - scaleOf()) < 1e-9,
    '连续 60 帧后加成依然保持（倒计时被持续续期）', String(boosted._cdScale))

  // 退出接管后不再续期，倒计时走完自动回正
  world.plants = []
  pulse()
  ok(bonusOf() === 0, '无大哥时加成为 0')
  ok(scaleOf() === 1, '无大哥时写入值为 1（不缩放）')
  const idle = mkPlant()
  idle.characterUpdate(0.1)
  ok(idle.cdScaleWrites.length === 0, '未接管时不碰植物的 _cdScale')
  ok(idle._cdScale === 1, '未接管时植物保持原速')

  // 大哥死后：先带增益，再模拟大哥阵亡、停掉续期连跑 2 秒，加成必须自己掉干净
  world.plants = [new FakeEntity('megagatling')]
  pulse()
  const doomed = mkPlant()
  doomed.characterUpdate(0.1)
  // 对着实时计算值比对，别硬编码档位 —— 场上株数一变，写死的分母就成了假警报
  ok(Math.abs(doomed._cdScale - scaleOf()) < 1e-9,
    '大哥存活时带增益', `实际 ${doomed._cdScale} 期望 ${scaleOf()}`)
  ok(doomed._cdScale < 1, '存活期间倍率确实小于 1')

  world.plants = []          // 大哥阵亡
  pulse()
  ok(T.bgmState.owned === false, '大哥阵亡后停止接管')
  for (let i = 0; i < 130; i++) doomed.characterUpdate(0.016)
  ok(Math.abs(doomed._cdScale - 1) < 1e-9,
    '停止续期 2 秒后自动回正为 1（大哥死后会掉 buff）', String(doomed._cdScale))
  ok(doomed._cdScaleByPlant === 1, '_cdScaleByPlant 也已复位')

  // 关卡结束 → 加成与 BGM 同步失效
  world.phase = 'lost'
  world.plants = [new FakeEntity('megagatling')]
  pulse()
  ok(bonusOf() === 0, '关卡结束时加成随之失效')
  world.phase = 'running'

  // ─────────────────────── D. 降级与鲁棒性 ───────────────────────

  section('D. 降级与鲁棒性')

  // 无 codename 可读 → 自动切换查询模式
  T.resetEntityMode()
  const opaque = [{ kind: 'plant', alive: true }]
  const savedList = modCtx.entities.list
  modCtx.entities.list = (q) => {
    if (q.codename) return q.codename === 'megagatling' ? [new FakeEntity('megagatling')] : []
    return opaque
  }
  ok(T.countFamily(modCtx) === 1, '读不到 codename 时自动降级为逐 codename 查询')
  modCtx.entities.list = savedList
  T.resetEntityMode()

  // entities.list 抛异常
  T.resetEntityMode()
  const ctxBoom = makeCtx({ entities: { list: () => { throw new Error('boom') } } })
  let threw = false
  let n = -1
  try { n = T.countFamily(ctxBoom) } catch (err) { threw = true }
  ok(!threw, 'entities.list 抛异常时不外泄')
  ok(n === 0, '异常时存活数按 0 处理')

  // game.getState 抛异常
  const ctxGameBoom = makeCtx({ game: { getState: () => { throw new Error('state boom') } } })
  threw = false
  try { T.bgmPulse(ctxGameBoom, 0.5) } catch (err) { threw = true }
  ok(!threw, 'game.getState 抛异常时 bgmPulse 不外泄')

  // 音频环境不可用（无 document）
  const saveDoc = globalThis.document
  delete globalThis.document
  T.bgmState.loaded = false
  T.bgmState.el = null
  T.bgmState.loadError = ''
  world.plants = [new FakeEntity('megagatling')]
  world.phase = 'running'
  MusicController._volumeScalePause = 1
  threw = false
  try { pulse() } catch (err) { threw = true }
  ok(!threw, '没有 HTML5 Audio 时状态机不抛异常')
  ok(T.bgmState.loaded === false, '标记为未加载')
  ok(T.bgmState.owned === false, '素材不可用时**不接管**，避免关卡变成哑巴')
  ok(MusicController._volumeScalePause === 1, '素材不可用时引擎音乐保持原样')
  ok(T.bgmState.lastReason.includes('素材不可用'), '给出正确的降级原因', T.bgmState.lastReason)
  globalThis.document = saveDoc
  MusicController._volumeScalePause = 1
  T.bgmState.scale = 1

  // 没有 unsafe.hooks 的宿主
  const mod2 = await import(entryUrl + '?v=degraded')
  let threw2 = false
  try {
    mod2.default.startup(makeCtx())
    mod2.default.setup(makeCtx({ unsafe: {}, advanced: {} }))
  } catch (err) { threw2 = true; console.log('    (异常: ' + err.message + ')') }
  ok(!threw2, '缺少 unsafe.hooks 时 setup 不抛异常')

  // 缺少全部实体 / 文件 API
  const mod3 = await import(entryUrl + '?v=bare')
  let threw3 = false
  try {
    const bare = makeCtx({ entities: undefined, files: undefined, runtime: undefined, controls: undefined })
    bare.log = { info: () => {}, warn: () => {}, error: () => {} }
    bare.ui = { toast: () => {} }
    mod3.default.startup(bare)
    mod3.default.setup(bare)
  } catch (err) { threw3 = true; console.log('    (异常: ' + err.message + ')') }
  ok(!threw3, '缺少 entities/files/runtime 时 setup 不抛异常')

  // 所有候选路径都读不到 → 不加载，也不接管
  const mod4 = await import(entryUrl + '?v=nobgm')
  const noBgmCtx = makeCtx({ files: { own: () => ({ readBytes: async () => null }) } })
  mod4.default.startup(noBgmCtx)
  mod4.default.setup(noBgmCtx)
  await new Promise((r) => setTimeout(r, 20))
  ok(mod4.__test__.bgmState.loaded === false, '候选路径全部读不到时标记为未加载')
  ok(/未找到|读不到/.test(String(mod4.__test__.bgmState.loadError)),
    '给出可读的失败原因', mod4.__test__.bgmState.loadError)

  // MIME 推断：素材格式换了也不能写死 audio/ogg
  const mime = T.mimeForPath
  ok(mime('audio/a.ogg') === 'audio/ogg', 'MIME 推断 .ogg')
  ok(mime('audio/a.mp3') === 'audio/mpeg', 'MIME 推断 .mp3')
  ok(mime('audio/a.m4a') === 'audio/mp4', 'MIME 推断 .m4a')
  ok(mime('audio/a.wav') === 'audio/wav', 'MIME 推断 .wav')
  ok(mime('audio/a.MP3') === 'audio/mpeg', 'MIME 推断对大小写不敏感')

  resetRecorder()
}
