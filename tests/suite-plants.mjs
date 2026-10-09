/**
 * A 组（元素豌豆）+ B 组（融合大哥）断言。
 */
import {
  ok, near, section,
  MegaGatlingPeaPlant, PeashooterPlant,
  SplitPeaPlant, ThreePeaterPlant, SlingPeaPlant, PrimalPeashooterPlant,
} from './harness.mjs'

export function runPlants({ T }) {
  // ─────────────────────── A. 元素豌豆 ───────────────────────

  section('A. 元素豌豆')

  const mg = new MegaGatlingPeaPlant()
  const N = 20000
  const tally = {}
  for (let i = 0; i < N; i++) mg.animationListener({ name: 'Shoot' })
  for (const s of mg.shots) tally[s] = (tally[s] || 0) + 1

  ok(mg.shots.length === N, `发射事件全部触发（${mg.shots.length}/${N}）`)
  ok(mg._own.PeaType === 'pea', '发射后 PeaType 已还原为原值')

  for (const entry of T.ELEMENTAL_TABLE) {
    const pct = ((tally[entry.type] || 0) / N) * 100
    near(pct, entry.weight, 1.5, `分布 ${entry.label} ≈ ${entry.weight}%`)
  }
  ok(T.stats.elementalShots === N, '统计发射数正确')

  const allowed = T.ELEMENTAL_TABLE.map((e) => e.type)
  ok(Object.keys(tally).every((k) => allowed.indexOf(k) >= 0), '没有出现表外弹种', JSON.stringify(Object.keys(tally)))

  // 非射击事件不干预
  const before = mg._own.PeaType
  mg.animationListener({ name: 'Eat' })
  mg.animationListener({ name: 'Idle' })
  ok(mg._own.PeaType === before, '非射击事件不改 PeaType')

  // Shoot5 未升级不发射
  const mg2 = new MegaGatlingPeaPlant()
  const shotsBefore5 = mg2.shots.length
  mg2.animationListener({ name: 'Shoot5' })
  ok(mg2.shots.length === shotsBefore5, 'Shoot5 未升级时不发射')
  ok(T.stats.elementalShots === N, 'Shoot5 未升级时不计入统计')

  // Shoot5 升级后发射
  mg2.upgraded = true
  mg2.animationListener({ name: 'Shoot5' })
  ok(mg2.shots.length === shotsBefore5 + 1, 'Shoot5 升级后正常发射')
  ok(T.stats.elementalShots === N + 1, 'Shoot5 升级后计入统计')
  ok(mg2._own.PeaType === 'pea', 'Shoot5 后 PeaType 已还原')

  // 实例隔离
  const mg3 = new MegaGatlingPeaPlant()
  mg3._own.PeaType = 'pea_snow'
  mg3.animationListener({ name: 'Shoot' })
  ok(mg3._own.PeaType === 'pea_snow', '实例隔离：另一株的原值不受影响')

  // ─────────────────────── B. 融合大哥 ───────────────────────

  section('B. 融合大哥')

  const realRandom = Math.random
  /** 把 Math.random 钉死，让 pick 的某一档必定命中 */
  const pinRandom = (v) => { Math.random = () => v }

  try {
    // 1) 双发/海豌豆正面大招 —— ID 白名单
    const dual = new PeashooterPlant(224, 'pea')
    dual.fooding = true
    pinRandom(0)
    dual.onFoodLeftPeaCountDec()
    ok(dual.shots[0] === T.FOOD_MIX[0].type, '大招混弹：ID 224 命中配比第一项', '实际 ' + dual.shots[0])
    ok(dual._own.PeaTypePlantfood === 'pea_food', '大招混弹后 PeaTypePlantfood 已还原')
    ok(T.stats.foodMix === 1, '大招混弹计数 +1')

    const dualIce = new PeashooterPlant(224, 'pea')
    dualIce.fooding = true
    pinRandom(0.99)
    dualIce.onFoodLeftPeaCountDec()
    ok(dualIce.shots[0] === T.FOOD_MIX[2].type, '大招混弹：0.99 命中配比第三项（火豆）', '实际 ' + dualIce.shots[0])

    // 非白名单 ID 不受影响
    const plain = new PeashooterPlant(1, 'pea')
    plain.fooding = true
    pinRandom(0)
    plain.onFoodLeftPeaCountDec()
    ok(plain.shots[0] === 'pea_food', 'ID 1 不在白名单，大招弹种保持原样')

    // 非 fooding 不受影响
    const chill = new PeashooterPlant(228, 'pea')
    pinRandom(0)
    chill.onFoodLeftPeaCountDec()
    ok(chill.shots[0] === 'pea_food', '非 fooding 时不干预')

    // 2) 裂荚
    const split = new SplitPeaPlant(225)
    split.fooding = true
    pinRandom(0)
    split.onFoodLeftPeaCountDec()
    ok(split.shots[0] === T.FOOD_MIX[0].type, '裂荚正面大招被混弹')

    const splitBack = new SplitPeaPlant(225)
    splitBack.fooding = true
    pinRandom(0)
    splitBack._shootBack(false, false, undefined)
    ok(splitBack.shots[0] === T.FOOD_MIX[0].type, '裂荚背面：第 3 个参数被替换')

    const splitBackIdle = new SplitPeaPlant(225)
    pinRandom(0)
    splitBackIdle._shootBack(false, false, undefined)
    ok(splitBackIdle.shots[0] === 'pea', '裂荚背面非 fooding 时不干预')

    // 3) 三线
    const three = new ThreePeaterPlant(222)
    three.fooding = true
    pinRandom(0)
    three._shoot3(0, 1, undefined)
    ok(three.shots[0] === T.FOOD_MIX[0].type, '三线：_shoot3 第 3 个参数被替换')

    const threeOther = new ThreePeaterPlant(999)
    threeOther.fooding = true
    pinRandom(0)
    threeOther._shoot3(0, 1, undefined)
    ok(threeOther.shots[0] === 'pea', '三线：非白名单 ID 不干预')

    // 4) 超级军炮（配比 60/35/5 → 区间 [0,.60) [.60,.95) [.95,1)）
    const sling = new SlingPeaPlant(226)
    sling.fooding = true
    pinRandom(0)
    sling.animationListener({ name: 'shoot' })
    ok(sling.shots[0] === T.SLING_MIX[0].type, '军炮大招：命中三弹种第一项（原豌）', '实际 ' + sling.shots[0])
    ok(T.stats.slingMix === 1, '军炮混弹计数 +1')

    pinRandom(0.97)
    const sling2 = new SlingPeaPlant(226)
    sling2.fooding = true
    sling2.animationListener({ name: 'shoot' })
    ok(sling2.shots[0] === T.SLING_MIX[2].type, '军炮大招：0.97 命中椰子炸弹')

    const slingIdle = new SlingPeaPlant(226)
    pinRandom(0)
    slingIdle.animationListener({ name: 'shoot' })
    ok(slingIdle.shots[0] === 'pea', '军炮非 fooding 时不干预')

    const slingOtherEvent = new SlingPeaPlant(226)
    slingOtherEvent.fooding = true
    pinRandom(0)
    slingOtherEvent.animationListener({ name: 'Eat' })
    ok(slingOtherEvent.shots.length === 0, '军炮非 shoot 事件不干预')

    // 5) 超级原豌普攻流星
    const primal = new PrimalPeashooterPlant(220)
    pinRandom(0)
    primal.animationListener({ name: 'Shoot' })
    ok(primal.shots[0] === T.PRIMAL.meteorType, '超级原豌：概率命中时改发流星')
    ok(T.stats.meteorNormal === 1, '流星计数 +1')
    ok(primal._own.PeaType === 'pea', '流星发射后 PeaType 已还原')

    const primal2 = new PrimalPeashooterPlant(220)
    pinRandom(0.99)
    primal2.animationListener({ name: 'Shoot' })
    ok(primal2.shots[0] === 'pea', '超级原豌：未命中概率时原样发射')

    const primalFood = new PrimalPeashooterPlant(220)
    primalFood.fooding = true
    pinRandom(0)
    primalFood.animationListener({ name: 'Shoot' })
    ok(primalFood.shots[0] === 'pea', '超级原豌：大招期间不改普攻弹')

    const primalOther = new PrimalPeashooterPlant(999)
    pinRandom(0)
    primalOther.animationListener({ name: 'Shoot' })
    ok(primalOther.shots[0] === 'pea', '超级原豌：非白名单 ID 不干预')
  } finally {
    Math.random = realRandom
  }
}
