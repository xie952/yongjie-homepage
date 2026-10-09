# 回滚脚本 —— 卡片出场动效升级（2026-09-25）
# 用法：项目根目录执行  pwsh -File docs/rollback/card-enter-20260925/restore.ps1
# 作用：把 index.css / choreo.js / animations.js / StatCard.jsx / useCountUp.js 还原到本轮改动前；
#       src/components/CountUp/ 为新增目录，还原后不再被引用，可手动删除。
#       执行后必须重建 —— Remove-Item -Recurse -Force dist; npm run build

$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'src__index.css'                = 'src/index.css'
  'src__lib__choreo.js'           = 'src/lib/choreo.js'
  'src__lib__animations.js'       = 'src/lib/animations.js'
  'src__components__StatCard.jsx' = 'src/components/StatCard.jsx'
  'src__hooks__useCountUp.js'     = 'src/hooks/useCountUp.js'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  $dir = Split-Path -Parent (Join-Path $root $map[$k])
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ""
Write-Host "还原完成。重建：Remove-Item -Recurse -Force dist; npm run build" -ForegroundColor Cyan
