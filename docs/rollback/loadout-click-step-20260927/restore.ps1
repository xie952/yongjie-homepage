# 回滚脚本 —— 轮播「点击侧卡切换」（2026-09-27）
# 用法：项目根目录执行  pwsh -File docs/rollback/loadout-click-step-20260927/restore.ps1
# 作用：还原 LoadoutCarousel.jsx / LoadoutCarousel.css 到本次改动前（点侧卡 = 跳到该卡，居中卡无点击行为）。
#       执行后必须重建：Remove-Item -Recurse -Force dist; npm run build
$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'LoadoutCarousel.jsx.bak' = 'src/components/LoadoutCarousel/LoadoutCarousel.jsx'
  'LoadoutCarousel.css.bak' = 'src/components/LoadoutCarousel/LoadoutCarousel.css'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ''
Write-Host '还原完成。重建：Remove-Item -Recurse -Force dist; npm run build' -ForegroundColor Cyan
