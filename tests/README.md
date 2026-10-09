# tests

模拟验收测试。不需要游戏本体，用假类还原引擎结构，在 node 里跑。

```bash
npm test          # 等价于 node tests/run.mjs
```

## 为什么要用假类而不是直接跑游戏

模组的核心逻辑是「钩子挂在哪、什么条件下改、什么时候还原」。
这些在没有引擎的情况下完全可测——只要假类的**监听器名、射击事件名、
方法签名**与真机一致。

`harness.mjs` 里的那张表是照 `docs/ENGINE-NOTES.md` 逐条核对过的。
**改这张表之前先回引擎确认**，否则会出现「测试通过、真机不触发」这种最贵的失败。

## 文件

| 文件 | 作用 |
|---|---|
| `harness.mjs` | 断言器 + 假植物类 + 假引擎 + ModContext 工厂 + HTML5 Audio 环境桩 |
| `suite-plants.mjs` | A 组（元素豌豆）与 B 组（融合大哥）行为断言 |
| `suite-bgm.mjs` | C 组（大哥 BGM 状态机）与 D 组（降级与鲁棒性）断言 |
| `suite-package.mjs` | E 组（交付物一致性：清单字段、数值补丁、BGM 文件） |
| `run.mjs` | 装配运行期、依次执行各 suite、汇总退出码 |

## 覆盖范围（108 项断言）

- **分布**：2 万次采样，六种豌豆的频率偏差 < 1.5 个百分点
- **还原**：每次发射后 `PeaType` / `PeaTypePlantfood` 必须回到原值
- **白名单**：融合大哥的 ID 过滤（220/222/224/225/226/228）与非白名单放行
- **`fooding`**：大招期间该跳过的跳过、该混弹的混弹
- **状态机**：无大哥 / 有大哥 / 大哥全灭 / `won` / `lost` / `ended` / `outside` / `preparing` / `waiting` / `paused` / 回到战斗
- **引擎静音**：接管时 `MusicController._volumeScalePause` 必须为 0，交还时必须回到 1
- **降级**：没有 HTML5 Audio、没有 `ctx.files`、`entities.list` 抛异常、`game.getState` 抛异常、缺少 `unsafe.hooks`
- **交付物**：清单字段、数值补丁内容、BGM 字节数与魔数

## 校验发布产物

`tools/pack.ps1` 打完之后会自动解包，并用包里的 `scripts/main.js`
重跑同一套断言（通过 `JBTMG_PKG_ROOT` / `JBTMG_ENTRY` 两个环境变量指过去）。
手动跑等价于：

```bash
JBTMG_PKG_ROOT=/path/to/unpacked JBTMG_ENTRY=/path/to/unpacked/scripts/main.js node tests/run.mjs
```

> 解包目录没有 `package.json`，`.js` 会被 node 当成 CommonJS。
> 要么在解包目录补一个 `{"type":"module"}`，要么把入口复制成 `.mjs`。
> `tools/pack.ps1` 走的是前者。
