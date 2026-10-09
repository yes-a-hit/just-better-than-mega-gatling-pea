# Just Better Than Mega Gatling

> 让「超级机枪射手」配得上它 600 阳光的身价：
> 全族武器升级、上场即接管关卡 BGM，并顺手给全场植物上一轮攻速加成。

| | |
|---|---|
| 版本 | 1.0.0 |
| 适配 | PvZ2 Gardendless 0.15.0 + GP-Next 1.5.0-pre.1 |
| 前置 | 无（需要开启 JavaScript 模组） |
| uuid | `yg.just-better-than-mega-gatling` |

---

## 效果展示

> 截图存放在仓库的 `effect/` 目录，**模组包内不含**——避免把安装包从 900 KB 撑到 6 MB。

**超级机枪射手 · 元素弹**
每次攻击按权重随机发射六种豌豆，同一排能同时看到火焰弹与寒冰弹。

![元素弹](<effect/element pea.png>)

**超级机枪双重射手 · 大招混弹**
大招喷出的弹药按 50 / 25 / 25 混入普通 / 寒冰 / 火焰豌豆。

![双发大招](<effect/双发大招.png>)

**原始超级机枪射手 · 普攻流星**
普攻有 10% 概率改发流星花的流星。

![原始豌豆](<effect/原始豌豆.png>)

**超级豌豆迫击炮 · 大招三弹种**
大招按 60% 原始豌豆 / 35% AKEE 弹跳 / 5% 椰子炸弹 抽取。

![迫击炮](<effect/迫击炮.png>)

---

## 功能

### 1. 大哥本体：元素弹

超级机枪射手每次攻击按权重随机发射六种豌豆：

| 弹种 | 概率 |
|---|---|
| 普通豌豆 | 35% |
| 寒冰豌豆 | 15% |
| 火焰豌豆 | 15% |
| 毒液豌豆 | 15% |
| 电能豌豆 | 10% |
| 原始豌豆 | 10% |

阳光消耗 450 → **600**。只影响大哥本体，其它豌豆系植物一点不动。

### 2. 大哥全族：大招混弹与普攻流星

- **超级机枪双重射手 / 三线超级机枪射手 / 超级机枪裂荚射手 / 超级机枪海豌豆**
  的大招弹药按 **50 / 25 / 25** 混入 普通豌豆 / 寒冰豌豆 / 火焰豌豆（裂荚正背面都算）
- **超级豌豆迫击炮** 的大招改成 **60% 原始豌豆 / 35% AKEE 弹跳 / 5% 椰子炸弹**
- **原始超级机枪射手** 的普攻有 **10%** 改发流星花的流星

钩子挂在父类原型上、再用植物 ID 卡死范围，普通植物完全不受影响。

### 3. 大哥 BGM 覆盖

| 情况 | 结果 |
|---|---|
| 场上有大哥 + 关卡战斗中 | 静音原 BGM，循环播放 `audio/mega-gatling-bgm.<扩展名>` |
| 大哥全部阵亡 | 停止大哥 BGM，恢复原 BGM |
| 关卡结束（胜利 / 失败 / 结算） | 立即换回原 BGM |
| 离开战斗（选卡 / 世界地图 / 禅境花园） | 不接管 |
| 游戏内暂停 | 保持接管 |

切换带约 0.35 秒淡入淡出，不会「啪」地断掉。

**「大哥」指以下 16 株**（名单取自游戏数据 `PlantFeatures.json` 中 `megagatling` 的 `SubPlantList`）：

`超级机枪射手` · `超级机枪双重射手` · `三线超级机枪射手` · `超级机枪裂荚射手` · `超级机枪豌豆荚` ·
`电能超级机枪射手` · `黏毒超级机枪射手` · `超级机枪海豌豆` · `火焰超级机枪射手` · `寒冰超级机枪射手` ·
`原始超级机枪射手` · `暗影超级机枪射手` · `超级豌豆迫击炮` · `超级机枪大嘴豌豆` · `超级机枪飞天射手` ·
`超级机枪机枪射手`

> 只作用于游戏的**音乐**通道。音效、僵尸叫声、卡牌音、大招音一律不受影响；
> 游戏设置里的「音乐音量」照样生效。

### 4. BGM 期间的全场攻速加成

大哥 BGM 接管期间，**全场植物**的攻击速度获得加成，而且**场上大哥越多越强**：

| 场上存活的大哥 | 攻击速度 |
|---|---|
| 0 株 | 无加成 |
| 1 株 | **+10%** |
| 2 株 | **+20%** |
| 3 株及以上 | **+30%**（封顶） |

加成与 BGM 同生共死：大哥全部阵亡、关卡结束或离开战斗时，BGM 一交还，加成随即失效——
它借的是引擎自带的限时缩放能力，松手后 1 秒内自然回正，不会残留。

> 作用于**攻击间隔**。向日葵产阳光、坚果这类不主动攻击的植物不受影响。

---

## 快速开始

1. 游戏内按 `F12`，在 Console 执行一次 `await gpNext.mods.enableJsModding()`
2. 取得安装包 ZIP —— 在 **Releases** 页面下载，或克隆本仓库后运行 `npm run pack` 自行打包
3. GP-Next 侧栏 → **模组** → **导入 ZIP**，选中上一步得到的 zip
4. **在模组列表里把它勾上**（导入后默认不勾，**不勾等于没装**）
5. 点 **保存并应用**，按提示重启游戏

就这四步——**不需要任何额外脚本、命令行或补丁工具**。

> **第 3 步最容易漏。** 包导入后在 `installed/` 和配置里都在，但 `enabled` 是 `false`，
> 此时 JS 一行不跑、数值补丁一条不生效，表现就像"没装"。先看勾选状态，别急着翻日志。

遇到问题见 [`docs/INSTALL.md`](docs/INSTALL.md)（含一份常见故障排查表）。

---

## 音频素材

包内已附带 `audio/mega-gatling-bgm.ogg`——一首用 **ACE-Step 1.5 XL Turbo**
本地生成的 8-bit 燃系战斗曲（BPM 148，60 秒，E minor），
**不采样自任何既有录音，也不涉及第三方音乐版权**。
来源与完整生成参数见 [`NOTICE.md`](NOTICE.md) 第 3 节。

想换成自己的曲子：把文件命名为 `mega-gatling-bgm.<扩展名>`
（`.ogg` / `.oga` / `.mp3` / `.m4a` / `.wav` 均可）放进 [`audio/`](audio/README.md) 即可。

即使没有可用音频，模组也会**安静降级**——不接管 BGM，关卡音乐照常播放，
不会出现"静音了却没东西可播"的情况。

---

## 项目结构

仓库根**同时就是模组根**——`pack.json` 在最顶层，所以 `git clone` 之后可以直接用
GP-Next 的「导入文件夹」选中仓库根，不需要额外构建步骤。

```
just-better-than-mega-gatling/
├── pack.json              GP-Next 模组清单
├── audio/                 包内 BGM（可替换，说明见 audio/README.md）
├── effect/                效果展示截图（仅仓库用，不进安装包）
├── jsons/objects/         数值补丁（PlantProps）
├── scripts/main.js        运行期入口（ESM）
├── tests/                 模拟验收测试（不需要游戏本体）
├── tools/pack.ps1         发布打包：白名单 + 校验 + 用产物复测
├── docs/
│   ├── INSTALL.md         安装、部署与排查
│   └── ENGINE-NOTES.md    引擎笔记：挂载点表、BGM 与攻速机制的全部依据
├── package.json           仅开发用（`type: module` + npm scripts）
├── LICENSE                MIT 全文
├── NOTICE.md              非代码内容的来源与归属
└── CHANGELOG.md
```

发布的 ZIP **只含运行时文件**
（`pack.json` + `README.md` + `LICENSE` + `NOTICE.md` + `audio/` + `jsons/` + `scripts/`），
`tests/`、`tools/`、`docs/`、`effect/`、`package.json` 等开发用文件不会进包——
`tools/pack.ps1` 用白名单控制，并会校验有没有漏进去、有没有漏掉必含项。

`LICENSE` 与 `NOTICE.md` 进包不是可选项：MIT 条款要求版权声明与许可声明
随软件的所有副本分发。

---

## 开发

需要 Node.js（跑测试）。打包需要 Windows PowerShell。

```bash
npm test              # 跑模拟验收测试
npm run pack          # 生成 dist/*.zip，并自动用打包产物复测一遍
npm run pack:personal # 本地自用版：把 private/ 里的素材并进包里
```

打包脚本做四件事：白名单暂存 → 正斜杠 ZIP → 校验条目与清单字段 → 解包并用包里的
`scripts/main.js` 重跑同一套断言。等价的手动复测：

```bash
JBTMG_PKG_ROOT=<解包目录> JBTMG_ENTRY=<解包目录>/scripts/main.js node tests/run.mjs
```

`private/` 已被 `.gitignore` 排除，用来放**仅本地自用**的素材，
`npm run pack:personal` 会把它覆盖进 `audio/` 再打包；公版打包完全忽略它。

测试细节见 [`tests/README.md`](tests/README.md)，引擎依据见
[`docs/ENGINE-NOTES.md`](docs/ENGINE-NOTES.md)。

### 为什么测试可以脱离游戏跑

模组逻辑的核心是「钩子挂在哪、什么条件下改、什么时候还原」，这些在没有引擎时完全可测——
只要假类的监听器名、射击事件名、方法签名与真机一致。`tests/harness.mjs` 里那张表是照
`docs/ENGINE-NOTES.md` 逐条核对过的；**改它之前先回引擎确认**，否则会出现
「测试通过、真机不触发」这种最贵的失败。

---

## 自定义

| 想改什么 | 改哪里 |
|---|---|
| 大哥 BGM 的曲子 | 放进 `audio/mega-gatling-bgm.<扩展名>` |
| 谁算「大哥」 | `scripts/main.js` 里的 `BGM.family` 名单 |
| 淡入淡出时长 | `scripts/main.js` 里的 `BGM.fadeSeconds`（默认 0.35 秒） |
| 心跳频率 | `scripts/main.js` 里的 `BGM.pollMs`（默认 100ms） |
| **全场攻速加成** | `scripts/main.js` 里的 `ATTACK_SPEED`（`perPlant` 每株大哥的加成、`max` 上限） |
| 元素豌豆的概率 | `scripts/main.js` 里的 `ELEMENTAL_TABLE` 权重表 |
| 大招混弹的配比 | `scripts/main.js` 里的 `FOOD_MIX` / `SLING_MIX` |
| 阳光消耗 | `jsons/objects/PlantProps.json` |

改完跑一遍 `npm test`——分布断言会直接告诉你权重写对没有。

---

## 已知限制

- **元素豌豆不做 ID 过滤。** 它挂在 `MegaGatlingPeaPlant.prototype.animationListener` 上；
  若将来版本出现「继承自 `MegaGatlingPeaPlant`」的衍生植物，它们会一并走这个随机弹。
- **BGM 覆盖依赖 `MusicController` 可达。** 拿不到这个类时（引擎版本差异），
  自带 BGM 仍会播放，但无法静音引擎原 BGM，此时两首会叠着放。面板「音乐音量标量」会显示 `1.00`，
  日志里也会写明。
- **BGM 走 HTML5 `Audio`。** 环境没有 `document` / `Blob` / `URL.createObjectURL`，
  或者音频素材不可用时，**模组不会接管 BGM**，引擎原 BGM 照常播放。
- **攻速加成依赖引擎的 `_cdScale` 限时缩放。** 若该 getter 在未来版本被移除，
  加成会自动失效（BGM 覆盖不受影响），面板「攻速钩子」会显示未挂载。
- 数值补丁生效需要重启；JS 钩子只影响运行时新建或更新的实例。

---

## 许可证与声明

代码与文档以 **[MIT 许可证](LICENSE)** 授权。

游戏数据标识符、引擎笔记的引用边界、商标归属等非代码内容，
见 **[`NOTICE.md`](NOTICE.md)**。

本仓库不附带任何游戏本体资源；运行本模组需要玩家自行拥有 PvZ2 Gardendless。
