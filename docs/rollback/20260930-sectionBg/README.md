# 回滚点：滚动驱动背景色两处缺陷修复（2026-09-30）

对应 `docs/项目交接文档.md` §25。

## 这个目录里是什么

| 文件 | 说明 |
| --- | --- |
| `src__lib__sectionBg.js` | **修复前**的 `src/lib/sectionBg.js` 全文（121 行，`__` 代替路径分隔符）。顶部加了一行"这是旧版"的警示注释，其余逐字节为原文件。 |

## 什么时候需要回滚

本轮改动只影响 `src/lib/sectionBg.js`，改的是**判定时机**，不涉及任何颜色/视觉参数：

| 症状 | 说明 |
| --- | --- |
| 滚动时底色切换比之前"跟手"太多、觉得闪 | 新加了 rAF 节流的滚动兜底触发；先在脚本里把 `index.css` 的 `transition: background-color 700ms ease` 调大观察，或按下面回滚。 |
| 快速滚动出现掉帧（低端机） | 兜底触发每帧最多 6 次 `getBoundingClientRect()`。本机 60fps 未复现，未在低端真机量过。 |

## 怎么回滚

```powershell
# 在 D:\DSH\游戏网站\yongjie-homepage 下执行
Copy-Item 'docs\rollback\20260930-sectionBg\src__lib__sectionBg.js' 'src\lib\sectionBg.js' -Force
npm run build
```

⚠ **不要用 `git checkout -- src/lib/sectionBg.js`**：该文件在本仓库里是**未跟踪**（untracked）状态，
仓库只有 2 个 commit，工作区堆着全部迭代（见交接文档 §13.4）。`git checkout` 会直接丢掉整份文件。

## 回滚后要重新跑的三支探针

修复前的两支缺陷探针（`repro-4949.mjs` / `sweep.mjs`）是**回归测试**，回滚后应当重新变红：

```powershell
cd D:\DSH\.tabbit-tmp\yongjie-probe-20260930
node sweep.mjs           # 期望：修好的版本 50/50；回滚后 45/50（y=870/930/990/1050/1110 错）
node repro-4949.mjs      # 期望：修好的版本 y=4949 → #201c18；回滚后 → #0b0a09
node secbg-verify.mjs    # 期望：两种版本都 6/6（这套只取样板块中心，覆盖不到交界）
```

前置条件：Edge 以 `--headless=new --remote-debugging-port=9333` 启动，
静态服务器 `node serve-main.mjs`（端口 5175）在跑，且已 `npm run build`。
