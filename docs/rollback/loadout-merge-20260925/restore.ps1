# 回滚脚本 —— 常用英雄/武器 合并为单一 3D 渐变轮播区块（2026-09-25）
# 用法：项目根目录执行  pwsh -File docs/rollback/loadout-merge-20260925/restore.ps1
# 作用：把 TianxuanSection.jsx 还原为「两个并列 DepthCarousel」的 §16 版本；
#       src/components/LoadoutCarousel/ 是本轮新增目录，还原后不再被引用，可手动删除。
#       执行后必须重建：Remove-Item -Recurse -Force dist; npm run build

$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$src = Join-Path $bak 'src__components__TianxuanSection.jsx'
if (Test-Path $src) {
  Copy-Item $src (Join-Path $root 'src/components/TianxuanSection.jsx') -Force
  Write-Host '[ok]   已还原 src/components/TianxuanSection.jsx' -ForegroundColor Green
} else { Write-Host '[skip] 备份缺失' -ForegroundColor Yellow }
Write-Host ''
Write-Host '还原完成。重建：Remove-Item -Recurse -Force dist; npm run build' -ForegroundColor Cyan
