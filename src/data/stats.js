// ============================================================
// ⭐⭐ 这是你的"档案库"——以后换真实数据，只改这个文件就行 ⭐⭐
// 页面布局代码不需要动，数据会全部自动更新。
// 所有数字、名字、链接都可以随便改，格式照抄即可。
// ============================================================

// ---------- 1. 玩家基础档案（首屏 + 档案版块用） ----------
// 2026-09-13 已按用户真实数据替换（第 1 段）
export const player = {
  id: "榭安",               // 游戏ID（"加我组队"按钮复制的就是它）
  slogan: "我身无拘，武道无穷",  // 首屏大标题下方的一句诗（Hero 组件目前另写死同一句）
  bio: "只打三排，征神半大佬。性别男，洗熊、LoveU熊。",
  playHours: 1700,              // 游戏总时长（小时）
  joinDate: "2023-12-01",       // 入坑日期（用户提供 2023-12，日补 01）
  rank: "无相龙王",             // 天选三排段位
  server: "steam国服",

  // 图片路径：文件放 public/ 后填 "/文件名"；null = 继续用占位
  avatar: null,
  // 档案区左侧：无相龙王段位纹章（已抠透明底）
  heroPortrait: "/profile-rank-crest.png",
  artPortrait: null,
  titleLogo: null,

  // 常用英雄（档案版块；avatar 为方形头像图，放 public/ 后填 "/文件名"）
  favHeroes: [
    { name: "哈迪", color: ["#5b7c99", "#0f141c"], avatar: "/hero-avatar-hadi.png" },
    { name: "殷紫萍", color: ["#7a4a9e", "#1a1028"], avatar: "/hero-avatar-yzp.png" },
    { name: "沈妙", color: ["#c47a3a", "#1c1208"], avatar: "/hero-avatar-shenmiao.png" }
  ],
  // 常用武器（档案版块）
  // media 可选：填 public 内路径；.png/.jpg/.webp 等显示照片，.mp4/.webm 显示视频
  // 例：media: "/weapons/quanren.jpg" 或 "/weapons/quanren.mp4"；不填则点击提示暂无素材
  favWeapons: [
    { name: "拳刃", media: "/quanren.mp4" },
    { name: "扇", media: "/shan.mp4" },
    { name: "长棍", media: "/changgun.mp4" },
    { name: "斩马刀", media: "/zhanmadao.mp4" }
  ],

  // 社交：无真实可点链接，先留空数组（Profile 会隐藏整块标题）
  socials: []
}

// ---------- 2. 天选之人（大逃杀排位） ----------
// 三个模式数据结构相同（都是排位，指标一样），但各自独立，方便单改
export const tianxuan = {
  lastUpdated: "2026-09-14",       // 数据更新日期，页面会自动算"X 天前"

  intro: "天选之人是《永劫无间》的核心排位玩法：六十名英雄空降聚窟洲，争夺不朽面具。搜集武器与魂玉，飞索拉扯、冷兵器拼刀，于暗域蔓延中活到最后，方为「天选之人」。青铜至无量梵天共十一阶，臻至修罗境界者可进入人数更精简、强度更高的「豪杰对局」，每一分皆由刀光剑影中拼杀而来。",

  // 2026-09-14 按游戏截图「所有赛季」；生存时间为秒；"—" 用 null
  // 双排未提供字段：保持原值或 null（显示 —）
  modes: {
    solo: {
      rank: "青铜",
      rankCrest: null,
      score: null,
      matches: 25,
      wins: 2,                     // 天选次数
      winRate: 8.0,                // 天选率
      top5: 7,                     // 前五数
      kills: 72,                   // 击败
      avgDamage: 8167,
      maxKills: 14,
      kd: 2.00,
      maxSurvival: 1389,           // 最长生存 23:09
      avgSurvival: 713,            // 场均生存 11:53
      maxMoveDist: 9135,           // 截图：最长移动距离
      avgMoveDist: 4516,           // 截图：场均移动距离
      avgRevives: 0,               // 显示 0.0
      avgHeal: 2158
    },
    duo: {
      rank: "无间修罗",
      rankCrest: "/rank-crest-duo.png",
      score: null,
      matches: 300,
      wins: 32,
      winRate: 10.7,
      top5: 179,
      kills: 1014,
      avgDamage: 10846,            // 保持现状
      maxKills: 24,                // 保持现状
      kd: 2.19,
      maxSurvival: null,           // —
      avgSurvival: null,
      maxMoveDist: null,
      avgMoveDist: null,
      avgRevives: 0.1,             // 保持现状
      avgHeal: 5066                // 保持现状
    },
    trio: {
      rank: "无相龙王",
      rankCrest: "/profile-rank-crest.png",
      score: null,
      matches: 866,
      wins: 86,
      winRate: 9.9,
      top5: 457,
      kills: 2173,
      avgDamage: 12374,
      maxKills: 14,
      kd: 1.23,
      maxSurvival: 1551,           // 25:51
      avgSurvival: 945,            // 15:45
      maxMoveDist: 12182,
      avgMoveDist: 7069,
      avgRevives: 0.2,
      avgHeal: 6309
    }
  },

  // 常用英雄卡片
  // 2026-09-14 按「英雄对比·游戏时间」：哈迪 154h / 殷紫萍 18h / 沈妙 14h
  // 三人合计 186h → 占比约 83% / 10% / 8%；截图无分模式数据，三模式共用同一使用率
  // themeColor = 卡片主题色（边框 hover / 光晕 / 进度条），**与排位模式无关**，
  // 切换单/双/三排只变 useByMode 的百分比，颜色不变。
  // 品质标签（传说/史诗/稀有）与皮肤行描边仍走品质配色，不受这里影响。
  heroes: [
    {
      name: "哈迪",
      themeColor: "#d4af58",   // 沿用改前实际金色（原 legendary 卡级色 rgb 212,175,88）
      avatar: "/hero-avatar-hadi.png",
      useByMode: { solo: 83, duo: 83, trio: 83 },
      skins: [
        // label 是可选的「显示文案覆盖」：只改标签文字，品质档位（rarity）与配色都不变
        { name: "斩神.米迦勒", imageUrl: "/hadipifu.PNG", rarity: "legendary", label: "极品" }
      ]
    },
    {
      name: "殷紫萍",
      themeColor: "#d4af58",   // 与哈迪同一金色（不再跟随品质 epic 的紫 176,96,224）
      avatar: "/hero-avatar-yzp.png",
      useByMode: { solo: 10, duo: 10, trio: 10 },
      skins: [
        // label = 显示文案覆盖；labelTheme = 标签字色跟随本卡主题色（读同一个 --hero-theme，不另写色值）
        { name: "墨染千秋.青玉案", imageUrl: "/yzppifu.PNG", rarity: "epic", label: "极品", labelTheme: true }
      ]
    },
    {
      name: "沈妙",
      themeColor: "#E5484D",   // 亮红（深底上做边框清晰；不用印章暗朱砂 #A6362B）
      avatar: "/hero-avatar-shenmiao.png",
      useByMode: { solo: 8, duo: 8, trio: 8 },
      skins: [
        { name: "星辉魔纱", imageUrl: "/shenmiaopifu.PNG", rarity: "rare", label: "神品", labelTheme: true }
      ]
    }
  ],

  // 常用武器卡片：皮肤图已升 4K，整图 contain 不裁剪
  // label      = 「显示文案覆盖」：只改标签文字，品质档位 rarity 不动（同英雄卡约定）
  // labelTheme = true → 标签字色改读本卡的 --hero-theme。武器卡那份 = stats.js 派生的 weaponTheme
  //              = 哈迪那条 themeColor（金 #d4af58）→ 四条「极品」统一金色，且与外框/内层描边**同源**：
  //              以后改主题金只改 stats.js 一处，框与标签同步变。**禁止在这里写死第二份金色**。
  // rarity     = 仍未动：它只服务描边 / 呼吸光晕的档位逻辑（common 那条不参与呼吸）。
  // 皮肤行必须带 data-rarity（WeaponCard 写）：fx.js 的 3 处档位绑定（:554/:636/:869）都靠它，
  // 否则标签文案一旦自定义（如「极品」），绑定会静默落空 / 退化成 common。
  weapons: [
    {
      name: "拳刃",
      image: "/Quanren.PNG",
      useByMode: { solo: 55, duo: 60, trio: 28 },
      skins: [
        { name: "甜心震荡", imageUrl: "/quanrenpifu.PNG", rarity: "epic", label: "极品", labelTheme: true }
      ]
    },
    {
      name: "扇",
      image: "/Shan.PNG",
      useByMode: { solo: 40, duo: 45, trio: 22 },
      skins: [
        { name: "折寒英", imageUrl: "/shanzipifu.PNG", rarity: "rare", label: "极品", labelTheme: true }
      ]
    },
    {
      name: "长棍",
      image: "/Gun.PNG",
      useByMode: { solo: 30, duo: 35, trio: 14 },
      skins: [
        { name: "打狗棒", imageUrl: "/gunpifu.PNG", rarity: "rare", label: "极品", labelTheme: true }
      ]
    },
    {
      name: "斩马刀",
      image: "/Zhanma.PNG",
      useByMode: { solo: 18, duo: 22, trio: 9 },
      skins: [
        { name: "劫涛.潮", imageUrl: "/zhanmapifu.PNG", rarity: "common", label: "极品", labelTheme: true }
      ]
    }
  ]
}

// ---------- 3. 征神之路（PVE 刷本） ----------
// 与排位不同：重点是等级、十殿门层数、魂玉搭配
// ---------- 武器卡主题色：只【引用】英雄卡的主题金，不新增第二份色值 ----------
// 值仍是 tianxuan.heroes 里哈迪那条的 themeColor；以后改主题金只改那一处，
// 英雄卡与武器卡（外框 hover / 内层皮肤框 / 跟随鼠标光晕）同步变。
const themeHero = tianxuan.heroes.find((h) => h.name === "哈迪") || tianxuan.heroes[0]
export const weaponTheme = {
  hex: themeHero.themeColor,
  rgb: hexToTriple(themeHero.themeColor),
}
function hexToTriple(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex || "").trim())
  return m ? [m[1], m[2], m[3]].map((h) => parseInt(h, 16)).join(", ") : ""
}

export const zhengshen = {
  lastUpdated: "2026-01-15",

  intro: "征神之路是《永劫无间》的 PVE 养成闯关玩法：选择英雄组队深入神异秘境，搜集元素魂玉、搭配法宝与潜能，以四象化、破罡武技迎战多阶段变身的强力首领，于刀光中征伐诸神。关卡「十殿门」层层递进，局内随机异象、越战越险，登顶更高层数即可提升征神段位、赢取英雄印等荣耀。",

  level: 100,                     // 征神等级（用户 2026-09-19 页面批注确认）
  shidianLayer: 20,               // 十殿门：历史最高「神伐 20 层」（用户 2026-09-18 确认）
  shidianStage: "神伐",           // 历史最高所在阶段名（展示用）
  shidianIsHistoricalMax: true,   // 全站数据口径：历史最高，非当前赛季
  matches: 6013,                  // 对局数量：6013 场（真实）
  seals: 37,                      // 英雄印数（截图未显示，待补）
  achievements: 126,              // 成就数（截图未显示，待补）

  // 常用英雄 + 魂玉搭配卡片（头像 4K 原图 contain，不裁剪）
  // detailImg = 详情图路径（弹窗大图）。填 null / 不填 → 弹窗显示「详细图待补充」占位；
  //             把图放进 public/ 后把路径写在这里即可显示，弹窗逻辑零改动。
  // 注意扩展名大小写：public/ 下这些素材是【大写 .PNG】（bingyun.PNG / leiyun.PNG / duyun.PNG），
  // 站内既有引用（/guqhan.PNG、/tongling.PNG 等）也是大写 —— Windows 本地不区分大小写，
  // 但换成大小写敏感的托管环境（如 GitHub Pages）就会 404，所以按真实大小写写。
  // 2026-09-19 按用户页面批注整体更名与改写：英雄名、流派名、魂玉、备注均以此处为准。
  // 注意英雄名与 avatar 文件名是一一对应的（顾清寒→guqhan / 万钧→wanjun / 无尘→wuchen）。
  heroBuilds: [
    {
      name: "顾清寒",
      avatar: "/guqhan.PNG",
      build: "元素暴击",
      jades: ["星陨.冰", "爆冰诀", "烈元诀"],
      note: "操作简单无脑vfff，伤害中等打野boss兼顾",
      detailImg: "/bingyun.PNG"
    },
    {
      name: "万钧",
      avatar: "/wanjun.PNG",
      build: "元素暴击",
      jades: ["星陨.雷", "游雷振", "御电奔雷"],
      note: "每秒爆发伤害最高、输出循环最快；振刀反馈感强手感爽",
      detailImg: "/leiyun.PNG"
    },
    {
      name: "无尘",
      avatar: "/wuchen.PNG",
      build: "元素暴击",
      jades: ["星陨.毒", "淬毒术", "沼生"],
      note: "对群无敌大毒爆高系数AOE，打boss破罡快伤害一般",
      detailImg: "/duyun.PNG"
    }
  ]
}

// ---------- 藏品卡主题色：只【引用】沈妙英雄卡的红，不新增第二份色值 ----------
// 与 weaponTheme（引用哈迪的金）同构 → 全站维持「金 / 红两源、各定义一次」的架构：
// 以后改沈妙那条 themeColor，藏品卡的外框 / 描边光效 / 文字三处同步变。
// 找不到沈妙时 hex/rgb 为空 → 调用方不注入变量、CSS 走既有回退，绝不静默换成别的英雄色。
const treasureHero = tianxuan.heroes.find((h) => h.name === "沈妙")
export const treasureTheme = {
  hex: treasureHero?.themeColor,
  rgb: hexToTriple(treasureHero?.themeColor),
}

// ---------- 4. 无间镖客（PVPVE 摸金撤离） ----------
// 三个境况：生境（低风险）/ 险境（中）/ 劫境（高难高回报）
export const wujian = {
  lastUpdated: "2026-01-12",

  intro: "无间镖客，《永劫无间》的摸金撤离玩法：自选装备入局，搜集遗珍、完成任务，与群雄拼刀夺宝；阵亡则战获尽失，唯有赶在撤离前杀出血路、安全带出。生境、险境、劫境，险中求富贵。",

  // 【数据口径 —— 别再把汇总数字抄进三个境】
  // 截图只给了两种口径：
  //   ① 分境口径：只有「撤离成功率」一列是三境各自的真实值；
  //   ② 汇总口径：「游戏场次 23 / 场均战获 25.5万 / 单局最高 76.94万」是三境加总，
  //      截图里没有分境拆分。
  // 所以：分境没拿到的字段一律写 null（卡片显示「—」），汇总值单独放进 totals。
  // 这样三个境不会出现三份一模一样的假数据（§7 铁律：数据宁缺勿假 / 三境场次禁止三份相同）。
  // 拿到分境截图后：把对应 null 直接换成数字即可，卡片会从「—」自动变成真实值。
  totals: {
    matches: 23,                    // 三境合计场次（截图"游戏场次"）
    avgValue: 255000,               // 三境场均带出（截图"场均战获" 25.5万）
    maxValue: 769400                // 三境单局最高（截图"单局最高战获" 76.94万）
  },

  modes: {
    shengjing: {                    // 生境（低风险）
      matches: null,                // 该境场次：等分境截图
      extractRate: 50.0,            // 撤离成功率：50.0%（截图"生境"列 —— 真实分境值）
      avgValue: null,               // 该境场均带出：等分境截图
      maxValue: null,               // 该境单局最高：等分境截图
      avgSurvival: null             // 该境场均存活：截图未显示
    },
    xianjing: {                     // 险境（中风险）
      matches: null,
      extractRate: 66.7,            // 撤离成功率：66.7%（截图"险境"列 —— 真实分境值）
      avgValue: null,
      maxValue: null,
      avgSurvival: null
    },
    jiejing: {                      // 劫境（高难高回报）
      matches: null,
      extractRate: 0.0,             // 撤离成功率：0.0%（截图"劫境"列 —— 真实分境值）
      avgValue: null,
      maxValue: null,
      avgSurvival: null
    }
  },

  // 藏品展示墙：局内带出的稀罕货，rarity 决定图标色块
  // 2026-09-19 按用户要求只保留「鎏金镇纸」一张实体卡：神伐·猎陶 / 错金刀币 已【从数据中删除】，
  // 不是 display:none / opacity:0 的假删除 —— 渲染列表自然收敛，DOM 中零残留。
  // 想恢复展示：把条目加回本数组即可（那两条本就只有 CSS 色块图标，没有独立资源文件要保管）。
  // imageUrl 可选：填 public 内路径 → 图标方框显示实图（4K contain 不裁剪）；不填则保留色块占位
  // label 可选：品质标签的「显示文案覆盖」（沿用皮肤条目的同一约定）——
  //             只改标签文字，档位 rarity 与配色仍按数据走，文案不影响行为。
  treasures: [
    { name: "游老爷铜铃", rarity: "epic", label: "神品", note: "一阵清脆的铃声响起，红黑色的雾气涌出铜铃，邪祟游老爷盘旋而出。", imageUrl: "/tongling.PNG" }
  ]
}

// ---------- 5. 特效开关（水波扭曲 / 滚动叠层转场） ----------
// 想关掉水波或换叠层模式，只改这里即可（改完记得 npm run build 再看 5175）
export const effects = {
  // 叠层转场模式：'hero' = 仅首屏被第一区块覆盖（默认，稳）｜'all' = 全站区块层层上叠（实验）
  coverMode: 'hero',

  // 水波参数（鼠标划过背景时的涟漪）
  ripple: {
    enabled: true,     // false = 完全关闭水波，视频直出
    strength: 9,       // 位移强度（像素，规格建议 8~10）
    frequency: 60,     // 环形波频率（越大波纹越密）
    speed: 1.8,        // 波速（每秒向外扩散几圈）
    decay: 1.6,        // 时间衰减（越大消散越快）
    life: 2.6          // 单个涟漪存活秒数（2~3s 内归零）
  }
}

// ---------- 6. 收尾页（组队招募 + 联系方式） ----------
export const closing = {
  title: "行走江湖，义气为先",
  subtitle: "缺人上分？开黑缺奶？征神缺输出？我都可以来。",
  contact: {
    gameId: "榭安",               // 游戏内加好友（就是你本人的ID）
    wechat: "yunji_xue",              // 微信（待你替换成真实微信）
    discord: "QingFeng#8864"          // 社区联系（待你替换）
  }
}
