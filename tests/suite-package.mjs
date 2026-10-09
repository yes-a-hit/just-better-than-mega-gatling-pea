/**
 * E 组：交付物一致性断言。
 * 默认校验仓库根；设置 JBTMG_PKG_ROOT 后可校验任意解包目录（用于验证发布的 ZIP）。
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { ok, section } from './harness.mjs'

export function runPackage({ pkgRoot }) {
  section('E. 包内容一致性')
  console.log(`  （校验目录：${pkgRoot}）`)

  const at = (rel) => path.join(pkgRoot, rel)

  const packJson = JSON.parse(readFileSync(at('pack.json'), 'utf8'))
  ok(packJson.uuid === 'yg.just-better-than-mega-gatling', 'uuid 正确')
  ok(packJson.name === 'Just Better Than Mega Gatling', 'name 正确')
  ok(packJson.apiVersion === 2, 'apiVersion = 2')
  ok(packJson.js && packJson.js.startup === true, 'js.startup = true（engine 访问权前提）')
  ok(!('requiredGpNextFeatures' in packJson), '未声明 requiredGpNextFeatures（本版本会拒绝加载）')
  ok(packJson.js.entry === 'scripts/main.js', 'js.entry 指向 scripts/main.js')
  ok(packJson.author === 'YG', 'author 正确')
  ok(!('depends' in packJson) && !('optionalDepends' in packJson), '无额外前置依赖')

  const props = JSON.parse(readFileSync(at('jsons/objects/PlantProps.json'), 'utf8'))
  const aliases = props.objects.map((o) => o.aliases[0])
  ok(aliases.includes('megagatling'), 'PlantProps 含 megagatling')
  ok(aliases.includes('threepeater_mgp'), 'PlantProps 含 threepeater_mgp')
  const megaProp = props.objects.find((o) => o.aliases[0] === 'megagatling')
  ok(megaProp.objdata.SunCost === 600, 'megagatling 阳光消耗 600（来自元素豌豆模组）')
  const tpProp = props.objects.find((o) => o.aliases[0] === 'threepeater_mgp')
  ok(tpProp.objdata.PlantfoodPeaCount === 180, 'threepeater_mgp 大招弹药 180（来自融合大哥模组）')
  ok(props.objects.every((o) => o.objclass === 'PlantProperties'), 'objclass 全部为 PlantProperties')

  // 音频素材允许 ogg / mp3 / m4a / wav 任一格式 —— 模组按候选列表自动识别，
  // 本地生成的音频不必先转码。
  const BGM_CANDIDATES = [
    'audio/mega-gatling-bgm.ogg',
    'audio/mega-gatling-bgm.oga',
    'audio/mega-gatling-bgm.mp3',
    'audio/mega-gatling-bgm.m4a',
    'audio/mega-gatling-bgm.wav',
  ]
  // BGM 素材是可选的：仓库默认不附带，由使用者自备。
  // 存在就校验格式；不存在只提示、不判失败 —— 模组会安静降级。
  const bgmFile = BGM_CANDIDATES.find((p) => existsSync(at(p)))
  if (bgmFile) {
    const bytes = readFileSync(at(bgmFile))
    const ext = bgmFile.slice(bgmFile.lastIndexOf('.'))
    ok(bytes.length > 8000, 'BGM 文件大小合理', `${bgmFile} = ${bytes.length} 字节`)
    const magicOk =
      (ext === '.ogg' || ext === '.oga')
        ? (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53)
        : ext === '.mp3'
          ? ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
             (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
          : ext === '.wav'
            ? (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46)
            : (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)
    ok(magicOk, `BGM 文件结构与扩展名相符（${ext}）`, bytes.slice(0, 4).toString('hex'))
  } else {
    console.log('  ⏭  未附带 BGM 素材（可选）—— 模组将不接管 BGM，关卡音乐照常播放')
  }
  ok(existsSync(at('audio/README.md')), 'audio/README.md 存在（说明素材如何自备）')

  // ── 许可与声明 ──
  // MIT 要求版权声明与许可声明随软件的所有副本分发，所以这两份必须能进发布包。
  ok(existsSync(at('LICENSE')), 'LICENSE 存在')
  ok(existsSync(at('NOTICE.md')), 'NOTICE.md 存在')

  const license = readFileSync(at('LICENSE'), 'utf8')
  ok(license.startsWith('MIT License'), 'LICENSE 以标准标题开头')
  ok(license.includes('Copyright (c) 2026 YG'), 'LICENSE 含版权行')
  ok(license.trim().endsWith('SOFTWARE.'), 'LICENSE 以标准 MIT 全文结尾，未追加附加条款')

  const notice = readFileSync(at('NOTICE.md'), 'utf8')
  ok(notice.includes('不含任何第三方模组代码'), 'NOTICE 声明不含第三方模组代码')
  ok(notice.includes('ACE-Step'), 'NOTICE 说明音频的生成来源')
  ok(notice.includes('第三方录音'), 'NOTICE 声明不含第三方录音或音乐作品')
  ok(notice.includes('互操作'), 'NOTICE 说明游戏数据的互操作性边界')
  ok(notice.includes('商标'), 'NOTICE 覆盖商标归属')
  ok(!/未获授权|你看到的我|yg\.mgp-fusion|megagatling-elemental/.test(license + notice),
    'LICENSE / NOTICE 不含授权存疑素材或历史项目痕迹')

  const readme = readFileSync(at('README.md'), 'utf8')
  ok(readme.includes('NOTICE.md'), 'README 指向 NOTICE.md')
  ok(readme.includes('包内已附带'), 'README 说明包内已附带 BGM')
  // 硬要求一：公版 README 必须读起来像一个全新项目。
  ok(!/mgp-fusion|megagatling-elemental|整合自|以往项目/.test(readme),
    'README 不含整合来历等历史信息')
  // 硬要求二：安装路径不能把用户推给额外脚本。
  ok(!/回来找作者|点\s*bat/i.test(readme + notice),
    'README / NOTICE 不含"回来找作者 / 点 bat"式指引')
  ok(readme.includes('不需要任何额外脚本'), 'README 明确说明无需额外脚本')

  const installPath = at('docs/INSTALL.md')
  if (existsSync(installPath)) {
    const install = readFileSync(installPath, 'utf8')
    ok(!/回来找作者|点\s*bat/i.test(install), 'INSTALL.md 不含"回来找作者 / 点 bat"式指引')
    ok(install.includes('不需要任何额外脚本'), 'INSTALL.md 明确说明无需额外脚本')
    ok(install.includes('与本模组无关'), 'INSTALL.md 把 afterProject 归因到环境而非本模组')
  }
}
