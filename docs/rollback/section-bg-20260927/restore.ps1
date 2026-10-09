# 回滚脚本 —— 滚动驱动全站背景色（2026-09-27）
# 用法：项目根目录执行  pwsh -File docs/rollback/section-bg-20260927/restore.ps1
# 作用：还原 index.css / App.jsx 到本次改动前，并删除新增的 src/lib/sectionBg.js。
#       执行后必须重建：Remove-Item -Recurse -Force dist; npm run build
# 备注：另有 git 快照 605cc36e2363559ba87cf81707bbfec5c63a4ea2（git stash create，未动工作区）
$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'index.css.bak' = 'src/index.css'
  'App.jsx.bak'   = 'src/App.jsx'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
$new = Join-Path $root 'src/lib/sectionBg.js'
if (Test-Path $new) { Remove-Item $new -Force; Write-Host '[ok]   已删除 src/lib/sectionBg.js' -ForegroundColor Green }
Write-Host ''
Write-Host '还原完成。重建：Remove-Item -Recurse -Force dist; npm run build' -ForegroundColor Cyan
