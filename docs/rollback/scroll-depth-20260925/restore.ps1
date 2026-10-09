# 回滚脚本 —— 卡片动效 / 版块反差 / 滚动驱动 三项落地（2026-09-25）
# 用法：项目根目录执行  pwsh -File docs/rollback/scroll-depth-20260925/restore.ps1
# 作用：把 index.css / lib/choreo.js / App.jsx 还原到本轮改动前；src/lib/segments.js 为新增文件，
#       还原后不再被引用，可手动删除（留着也不会执行）。
#       执行后必须重建 —— Remove-Item -Recurse -Force dist; npm run build

$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'src__index.css'        = 'src/index.css'
  'src__lib__choreo.js'   = 'src/lib/choreo.js'
  'src__App.jsx'          = 'src/App.jsx'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ""
Write-Host "还原完成。重建：Remove-Item -Recurse -Force dist; npm run build" -ForegroundColor Cyan
