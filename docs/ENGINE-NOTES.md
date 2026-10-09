# 引擎笔记

本模组用到的全部引擎事实，逐条核对而来，**不是推测**。
改动 `scripts/main.js` 的挂载点或 BGM 逻辑之前，先回这里对照。

> **来源与引用**
> 本文件是对 PvZ2 Gardendless 运行期行为的**互操作性观察笔记**，
> 用于让本模组正确地与目标软件配合，**不复制其源代码**。
> 文中摘录的少量标识符与实现片段，是为说明互操作所必需的**最小引用**，
> 版权归原项目 `Gzh0821/pvzge_web` 及其权利人所有；本仓库不分发该项目的任何文件。
> 完整声明见 [`NOTICE.md`](../NOTICE.md)。

**来源**：`Gzh0821/pvzge_web` 仓库的 `docs/assets/main/index.js`（未压缩 bundle，约 3.75 MB，可直接 grep）。
本地缓存的副本为 3,750,162 字节，脚本用的就是它。

---

## 1. 核心发射机制

绝大多数豌豆系植物的发射流程是：

```
动画事件 → 监听器 → 读 this.objdataOwn.PeaType → 生成投射物
```

- `objdataOwn` 是**每株植物各自的 props 实例**（构造函数里 `new`），改写只影响本体。
- 换弹的通用做法：收到射击事件后、`_shoot` 执行前替换 `PeaType`，调用后还原。
- `fooding` 为真时（能量豆 / 大招期间）各植物会改用 `PeaTypePlantfood`。
- `_shoot` 内部虽是异步函数，但读取 `PeaType` 发生在第一个 `await` 之前，
  所以同步的 `try / finally` 足以覆盖还原时机。

## 2. 已核对的植物挂载点

**这张表必须逐个照抄，不能靠类推。** 同一个「豌豆系」里监听器名和事件名都可能不同。

| 植物 | codename | 引擎类 | 监听器 | 射击事件 |
|---|---|---|---|---|
| 超级机枪射手 | `megagatling` | `MegaGatlingPeaPlant` | `animationListener` | `Shoot` / `Shoot5`（Shoot5 需 `upgraded`） |
| 机枪射手 | `gatling` | `GatlingPeaPlant` | `animationListener` | `Shoot` |
| 豌豆射手 | `peashooter` | `PeashooterPlant` | `animationListener` | `Shoot` |
| 豌豆迫击炮 | `slingpea` | `SlingPeaPlant` | `animationListener` | `shoot` |
| 双发射手 | `repeater` | `RepeaterPlant` | `animationListener` | `Shoot` |
| 三发射手 | `threepeater` | `ThreePeaterPlant` | `animationListener` | `shootM` / `shootU` / `shootD` |
| 豌豆荚 | `peapod` | `PeaPodPlant` | `animationListener` | `Shoot0`~`Shoot4`（`ShootMega` 是大招，勿含） |
| 裂荚射手 | `splitpea` | `SplitPeaPlant` | **`specialPeashooterAnimationListener`** | `ShootL` / `ShootR` |
| 寒冰射手 | `snowpea` | `SnowPeaPlant` | **`animationListener`（基类）** | `Shoot` |
| 毒液豌豆 | `poisonpeashooter` | **`GooPeashooterPlant`** | **`animationListener`（基类）** | `Shoot` |
| 火焰豌豆 | `firepeashooter` | `FirePeashooterPlant` | **`animationListener`（基类）** | `Shoot` |
| 电能豌豆 | `electricpeashooter` | **`ElectricPeashooter`**（无 Plant 后缀） | `animationListener` | `Shoot` |
| 充能柚子 | `citron` | `CitronPlant` | `animationListener` | `shoot` |
| 甜椒投手 | `pepperpult` | `PepperPultPlant` | `specialCabbagePultAnimationListener` | `foodLobL/R/M` |

本模组装了 7 个挂载点：

| 组 | 挂载目标 | 方法 | 过滤条件 |
|---|---|---|---|
| A | `MegaGatlingPeaPlant.prototype` | `animationListener` | 事件名 ∈ {`Shoot`, `Shoot5`} |
| B | `PeashooterPlant.prototype` | `onFoodLeftPeaCountDec` | ID ∈ {224, 228} 且 `fooding` |
| B | `SplitPeaPlant.prototype` | `onFoodLeftPeaCountDec` | ID = 225 且 `fooding` |
| B | `SplitPeaPlant.prototype` | `_shootBack` | ID = 225 且 `fooding` |
| B | `ThreePeaterPlant.prototype` | `_shoot3` | ID = 222 且 `fooding` |
| B | `SlingPeaPlant.prototype` | `animationListener` | 事件名 `shoot` + ID = 226 + `fooding` |
| B | `PrimalPeashooterPlant.prototype` | `animationListener` | 事件名 `Shoot` + ID = 220 + 非 `fooding` |

ID 取自 `PlantFeatures.json`：`primalpeashooter_mgp`=220、`threepeater_mgp`=222、
`repeater_mgp`=224、`splitpea_mgp`=225、`slingpea_mgp`=226、`seashooter_mgp`=228。
引擎里 Plant 实例的 `this.ID` 就是这张表的 ID。

两组的挂载点**互不重叠**：A 挂在本体自己定义的 `animationListener` 上，
B 挂在父类原型上并用 ID 卡死范围，所以 `MegaGatlingPeaPlant`（ID 9）不会被 B 组误伤。

## 3. 两个容易踩的取值细节

1. **`_shoot()` 的默认类型来自 `this.defaultPea`（getter），不是直接读 `PeaType`。**
   基类 `defaultPea` 返回 `this._objdataOwn.PeaType`，但**寒冰射手覆写**成
   `Math.random() < ChanceToFreeze ? PeaFreezeType : PeaType`（`ChanceToFreeze = 0.2`）。
   所以改寒冰的弹种时 **`PeaType` 和 `PeaFreezeType` 都要改**，否则只有 80% 生效。

2. **投射物接口是单发的**：`shootOnePea(type, pos, height, layer, velocity, side, mintBoosted)`。
   想做「一次 N 颗」要额外调用 `this._shoot()`（N−1 次），而不是找批量接口。

## 4. 类定位三路（按副作用从小到大）

GP-Next 只在 `startup(ctx)` 阶段提供 `ctx.engine`：

```js
ctx.engine.getCc()                              // 拿 Cocos 命名空间
cc.js.getClassByName('XxxPlant')                // 纯查表，最安全，优先
ctx.engine.getClassByName('XxxPlant')           // 次选
ctx.engine.getModuleExport('chunks:///_virtual/Xxx.ts', 'XxxPlant')  // 可能触发模块解析，末位
```

**`setup(ctx)` 里没有 `ctx.engine`**，只有 `ctx.unsafe` / `ctx.advanced`（未文档化的字典）。

`MusicController` 不是 `Component`，没有 ccclass 装饰器，**不在 cc 类表里**，
只能走 `getModuleExport('chunks:///_virtual/SoundsController.ts', 'MusicController')`。

## 5. BGM 系统（本模组 BGM 覆盖的依据）

关卡 BGM 全部由 `SoundManager` 播放，相关成员：

| 成员 | 说明 |
|---|---|
| `audioSource` / `audioSourceReplay` | 主 / 副播放器（交叉淡入用） |
| `audioSourcePiano` / `audioSourceHoliday` / `audioSourceInsert` | 钢琴、节日、插播通道 |
| `currentMusic` | 当前 `Music` 对象（含 `clip`） |
| `currentPlayingComponent` | 当前正在出声的播放器 |
| `BackgroundMusic` | getter，`MusicEnum` → `Music` 映射 |
| `pauseBGM()` / `resumeBGM()` / `stopMusic()` | 暂停 / 恢复 / 停止 |
| `playBGM(musicEnum, loop, repeat)` / `switchMusic(...)` / `switchMusicSort(...)` | 选曲 |

`SoundManager.update()` 每帧重算音量，**这是整个 BGM 覆盖的支点**：

```js
this.currentPlayingComponent.volume =
  (this._insertedMusic || pianoCountDown > 0 || holidayCountDown > 0)
    ? 0
    : MusicController.MusicVolume * MusicController._volumeScalePause
```

也就是说：**只要 `MusicController._volumeScalePause === 0`，全部音乐通道每帧都会被写成 0。**

`SoundsController.ts` 里的静态定义：

```js
MusicController.MusicVolume = 1
MusicController._volumeScalePause = 1
MusicController._speedScalePause = 1
```

### `_volumeScalePause` 的全部写入点（已扫全文确认）

| 位置 | 行为 |
|---|---|
| `SoundsController.ts` | 静态初始化 `= 1` |
| `SoundManager.start()` | `= 1` |
| `KeyListener.ts` | 加载完成后 `= 1` |
| `zenGardenScene.ts` | `= 1` |
| `mainScene.ts` | 进场 `= 0`，然后 tween 到 1 |
| `worldMapScene.ts` | 进场 `= 0`，然后 tween 到 1 |
| `UI.ts` | 暂停时每帧 `-1/60` 渐降到 0；恢复时 `+1/60` 渐升回 1 |

**结论**：

- 它是引擎自己的「音乐音量标量」，正常值 1、暂停时渐降到 0。
- 把它压 0 等于静音**全部音乐通道**，音效走独立的 `SoundFXController`，**完全不受影响**。
- 交还时写回 `1` 是安全的：引擎的暂停 / 淡入逻辑每帧都会**自我修正**，
  不需要（也无法可靠地）保存旧值；写 0 中途被引擎复位最多丢一帧。
- 因此本模组**不接管引擎的选曲逻辑**（不碰 `playBGM` / `switchMusic`），
  只做「静音 + 自带播放器」——任何时刻松手，引擎下一帧就把音量写回它认为正确的值。

### 为什么心跳用 `runtime.setInterval` 而不是 `clock.onTick`

`clock` 走游戏秒、跟随暂停与加速，**结算和胜负界面期间可能不再跳动**，
那样「游戏结束时换回原 BGM」就可能永远不触发。
`runtime.setInterval` 走真实毫秒，暂停、结算、胜负界面期间照样在跑。

## 6. 投射物与伤害

伤害挂在投射物上。本模组用到的弹种：

| 投射物 | 伤害 | 附加 | 类型 |
|---|---|---|---|
| `pea` | 20 | — | 直线 |
| `pea_primal` | 60 | 击退 1s | 直线 |
| `pea_snow` | — | 减速 | 直线 |
| `pea_flame_yellow` | — | 灼烧 | 直线 |
| `pea_goo` | — | 中毒 | 直线 |
| `electricpea` | — | 电弧 | 直线 |
| `akee` | — | 弹跳 | 直线 |
| `coconut` | 900 | 溅射 300、震屏 | 直线 |
| `meteor` | 100 | 溅射 100（3×1）、震屏、温暖 | 直线 |
| `blastberry` | 100 | **`ShotCount:5` + `ShotType` → 发射器型，勿用于投掷路径** | 发射器 |

### 投掷路径的限制

`SlingPeaPlant._shoot` 不生成普通投射物，而是对每个目标调用 `lobOneCabbageOnZombie(peaType, ...)`。
它按「普通投射物」处理传进来的弹种——**发射器型弹种（自带 `ShotCount` / `ShotType`）在此路径下不结算伤害**，
表现为子弹飞出去了但打不掉血。该路径只接受直线型弹种。

`akee` / `coconut` / `pea_primal` 均为直线型，能在投掷路径正常结算。

## 7. 数据文件位置

| 内容 | 文件 |
|---|---|
| 植物 codename / 名称 / 卡牌资源名 / `SubPlantList` | `Features\PlantFeatures.json` |
| 植物数值（`SunCost` / `Cooldown` / `ShootInterval` / `PeaType`） | `Objects\PlantProps.json` |
| 投射物伤害与效果 | `Objects\ProjectileProps.json` |
| 关卡 BGM 定义（`Musics[]`：`name` / `path` / `musicLength` / `world` / `type`） | `music\MusicFeatures.json` |
| 图鉴文本 | `Objects\PlantAlmanac.json` |
| 僵尸数值 | `Objects\ZombieProps.json` |

**注意**：`ShootInterval` 既可能是数字，也可能是 `{ Min, Max }` 范围对象，
引擎侧走 `getRandomFromRange`。改的时候保持原结构类型。
