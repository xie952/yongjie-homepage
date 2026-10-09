# 回滚脚本 —— 轮播卡片底部内边距（皮肤卡下移，与使用率进度条拉开间距）（2026-09-27）
# 用法：项目根目录执行  pwsh -File docs/rollback/lo-card-pad-20260927/restore.ps1
# 作用：还原 LoadoutCarousel.css 的 .lo-card padding-bottom 到本次改动前（三边等距 24/18px）。
#       执行后必须重建：Remove-Item -Recurse -Force dist; npm run build
$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{ 'LoadoutCarousel.css.bak' = 'src/components/LoadoutCarousel/LoadoutCarousel.css' }
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ''
Write-Host '还原完成。重建：Remove-Item -Recurse -Force dist; npm run build' -ForegroundColor Cyan
