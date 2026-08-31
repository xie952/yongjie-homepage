// ============================================================
// ⭐⭐ 这是你的"档案库"——以后换真实数据，只改这个文件就行 ⭐⭐
// 页面布局代码不需要动，数据会全部自动更新。
// 所有数字、名字、链接都可以随便改，格式照抄即可。
// ============================================================

// ---------- 1. 玩家基础档案（首屏 + 档案版块用） ----------
export const player = {
  id: "青锋映雪",               // 你的游戏ID（"加我组队"按钮复制的就是它）
  slogan: "剑气纵横三万里，一刃霜寒十九州",  // 首屏大标题下方的一句话标语
  bio: "从青铜一路杀到陨星的散人玩家，擅长单排拉扯，也爱和朋友三排吃鸡。喜欢长剑与匕首的快节奏博弈，最近在肝征神之路十殿门。不嫌弃的话，组个队？",
  playHours: 1286,              // 游戏总时长（小时）
  joinDate: "2021-08-14",       // 入坑日期
  rank: "陨星",                 // 主档案展示的段位（必须来自下方 11 段位之一）
  server: "国服 · 东北一区",     // 服务器

  // 常用英雄头像占位色块：每个英雄给一个渐变色，之后想换真人立绘就在这里加图片路径
  avatar: null,                 // 你的头像图片路径，例如 "/src/assets/avatar.png"，没有就留 null
  heroPortrait: null,           // 档案区大立绘占位图片路径，没有就留 null

  // 常用英雄（档案版块显示 3-5 个）
  favHeroes: [
    { name: "宁红夜", color: ["#7a1f2b", "#1a0f0d"] },
    { name: "顾清寒", color: ["#3b5b92", "#0e1526"] },
    { name: "季沧海", color: ["#a03a1e", "#24100a"] },
    { name: "崔三娘", color: ["#2e7d6b", "#0b1f1a"] }
  ],
  // 常用武器（档案版块显示）
  favWeapons: ["长剑", "匕首", "弓箭"],

  // 社交账号入口：想加/换平台就改这里，icon 目前支持 bilibili / douyin / weibo / weixin / youtube / x / 默认
  socials: [
    { name: "B站", url: "https://space.bilibili.com/你的UID", icon: "bilibili" },
    { name: "抖音", url: "https://www.douyin.com/user/你的ID", icon: "douyin" },
    { name: "微博", url: "https://weibo.com/u/你的ID", icon: "weibo" }
  ]
}

// ---------- 2. 天选之人（大逃杀排位） ----------
// 三个模式数据结构相同（都是排位，指标一样），但各自独立，方便单改
export const tianxuan = {
  lastUpdated: "2026-01-20",       // 数据更新日期，页面会自动算"X 天前"

  intro: "天选之人是《永劫无间》的核心排位玩法：60 人空投落地，搜刮、博弈、缩圈、活到最后。段位从青铜到无量梵天共十一阶，每一个大段都是刀光剑影里杀出来的。",

  modes: {
    solo: {
      rank: "坠日",                // 当前段位（11段位之一）
      score: 4126,                 // 当前积分
      matches: 863,                // 场次
      winRate: 11.4,               // 胜率（%）
      avgDamage: 12680,            // 场均伤害
      maxKills: 18,                // 最高击杀
      kd: 2.36,                    // KD（击杀/死亡比）
      avgRevives: 0.6,             // 场均救援（次）
      avgHeal: 2450                // 场均治疗
    },
    duo: {
      rank: "蚀月",
      score: 3560,
      matches: 421,
      winRate: 16.8,
      avgDamage: 13840,
      maxKills: 22,
      kd: 2.91,
      avgRevives: 1.2,
      avgHeal: 3180
    },
    trio: {
      rank: "陨星",
      score: 3302,
      matches: 527,
      winRate: 14.2,
      avgDamage: 13210,
      maxKills: 16,
      kd: 2.58,
      avgRevives: 1.5,
      avgHeal: 3020
    }
  },

  // 常用英雄卡片：usage 是"该英雄登场时用哪个模式的使用率"。
  // 这里用 useByMode 给三个模式分别配使用率，Tab 切换时会跟着变。
  heroes: [
    {
      name: "宁红夜",
      useByMode: { solo: 32, duo: 28, trio: 30 },   // 各模式使用率（%）
      skins: [
        { name: "赤练·绯月", imageUrl: "", rarity: "legendary" },  // 传说
        { name: "刺客·玄夜", imageUrl: "", rarity: "epic" }        // 史诗
      ]
    },
    {
      name: "顾清寒",
      useByMode: { solo: 24, duo: 26, trio: 22 },
      skins: [
        { name: "寒酥·雪语", imageUrl: "", rarity: "epic" },
        { name: "冰魄·素问", imageUrl: "", rarity: "rare" }
      ]
    },
    {
      name: "季沧海",
      useByMode: { solo: 18, duo: 20, trio: 19 },
      skins: [
        { name: "烈焰·腾蛇", imageUrl: "", rarity: "legendary" }
      ]
    },
    {
      name: "崔三娘",
      useByMode: { solo: 14, duo: 16, trio: 17 },
      skins: [
        { name: "沧浪·惊涛", imageUrl: "", rarity: "rare" },
        { name: "龙女·织水", imageUrl: "", rarity: "common" }
      ]
    }
  ],

  // 常用武器卡片
  weapons: [
    {
      name: "长剑",
      useByMode: { solo: 30, duo: 32, trio: 34 },
      skins: [
        { name: "青锋·无影", imageUrl: "", rarity: "legendary" },
        { name: "玄铁·重剑", imageUrl: "", rarity: "rare" }
      ]
    },
    {
      name: "匕首",
      useByMode: { solo: 28, duo: 24, trio: 21 },
      skins: [
        { name: "幽刃·噬魂", imageUrl: "", rarity: "epic" }
      ]
    },
    {
      name: "弓箭",
      useByMode: { solo: 18, duo: 20, trio: 22 },
      skins: [
        { name: "朔风·穿云", imageUrl: "", rarity: "rare" }
      ]
    }
  ]
}

// ---------- 3. 征神之路（PVE 刷本） ----------
// 与排位不同：重点是等级、十殿门层数、魂玉搭配
export const zhengshen = {
  lastUpdated: "2026-01-15",

  intro: "征神之路是 PVE 玩法：组队进本、打怪刷宝、培养武魂与魂玉搭配。十殿门层层递进，越深越难，是检验装备与手法配合的试炼场。",

  level: 92,                      // 征神等级
  shidianLayer: 18,               // 十殿门层数（1-20）
  matches: 640,                   // 对局数量
  seals: 37,                      // 英雄印数
  achievements: 126,              // 成就数

  // 常用英雄 + 魂玉搭配卡片
  heroBuilds: [
    {
      name: "顾清寒",
      build: "暴击流",
      jades: ["暴伤·青", "攻速·玄", "吸魂·赤"],   // 魂玉（可多写几个）
      note: "高天掉落堆里最稳的一套，清怪快、爆发足。"
    },
    {
      name: "宁红夜",
      build: "回气流",
      jades: ["回气·金", "减耗·玄", "增伤·紫"],
      note: "靠技能循环打压制，容错高，适合开荒高层。"
    },
    {
      name: "季沧海",
      build: "火伤流",
      jades: ["火伤·朱", "暴伤·青", "攻速·玄"],
      note: "爆发天花板，但比较吃操作，打BOSS利器。"
    }
  ]
}

// ---------- 4. 无间镖客（PVPVE 摸金撤离） ----------
// 三个境况：生境（低风险）/ 险境（中）/ 劫境（高难高回报）
export const wujian = {
  lastUpdated: "2026-01-12",

  intro: "无间镖客是 PVP+PVE 混合玩法：进图摸金、打怪、也会遭遇其他玩家，活着带出物资才算赢。生境稳健、劫境富贵险中求。",

  modes: {
    shengjing: {                    // 生境
      matches: 312,                 // 场次
      extractRate: 68.4,            // 撤离成功率（%）
      avgValue: 185600,             // 场均带出物资价值
      maxValue: 860000,             // 最高单局带出价值
      avgSurvival: 14.6             // 场均存活时间（分钟）
    },
    xianjing: {                     // 险境
      matches: 186,
      extractRate: 52.1,
      avgValue: 342000,
      maxValue: 1280000,
      avgSurvival: 18.3
    },
    jiejing: {                      // 劫境
      matches: 74,
      extractRate: 33.5,
      avgValue: 605000,
      maxValue: 2150000,
      avgSurvival: 22.8
    }
  },

  // 藏品展示墙：局内带出的稀罕货，rarity 决定边框颜色
  treasures: [
    { name: "鎏金镇纸", rarity: "legendary", note: "劫境·幽窟深处" },
    { name: "犀角杯",   rarity: "epic",      note: "险境·地宫密室" },
    { name: "错金刀币", rarity: "epic",      note: "险境·响马营地" },
    { name: "白玉扳指", rarity: "rare",      note: "生境·镖局库房" },
    { name: "驼铃串",   rarity: "rare",      note: "生境·古道驿站" },
    { name: "青花盏",   rarity: "common",    note: "险境·过桥钱庄" }
  ]
}

// ---------- 5. 收尾页（组队招募 + 联系方式） ----------
export const closing = {
  title: "少侠留步，组个队？",
  subtitle: "缺人上分？开黑缺奶？征神缺输出？我都可以来。",
  contact: {
    gameId: "青锋映雪",               // 游戏内加好友
    wechat: "yunji_xue",              // 微信（写你的，或删掉这行）
    discord: "QingFeng#8864"          // 社区联系
  }
}