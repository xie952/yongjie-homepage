# 回滚脚本 —— 常用英雄 / 常用武器 改由 DepthCarousel 承载（2026-09-25）
# 用法：项目根目录执行  pwsh -File docs/rollback/depth-carousel-20260925/restore.ps1
# 作用：还原 TianxuanSection.jsx / index.css / choreo.js；src/components/DepthCarousel/ 为新增目录，
#       还原后不再被引用，可手动删除。执行后必须重建：Remove-Item -Recurse -Force dist; npm run build

$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'src__components__TianxuanSection.jsx' = 'src/components/TianxuanSection.jsx'
  'src__index.css'                       = 'src/index.css'
  'src__lib__choreo.js'                  = 'src/lib/choreo.js'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ""
Write-Host "还原完成。重建：Remove-Item -Recurse -Force dist; npm run build" -ForegroundColor Cyan
