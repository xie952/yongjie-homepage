# 回滚脚本 —— 卡片列表「由中心向两侧」入场动效（2026-09-22）
# 用法：项目根目录执行  pwsh -File docs/rollback/card-fan-20260922/restore.ps1
# 作用：把 6 个被改动的文件还原到本次动效【之前】的状态。其它文件不受影响。
# 注意：执行后需重建 —— Remove-Item -Recurse -Force dist; npm run build

$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

$map = @{
  'src__lib__animations.js'                 = 'src/lib/animations.js'
  'src__lib__join.js'                       = 'src/lib/join.js'
  'src__lib__fx.js'                         = 'src/lib/fx.js'
  'src__components__TianxuanSection.jsx'    = 'src/components/TianxuanSection.jsx'
  'src__components__ZhengshenSection.jsx'   = 'src/components/ZhengshenSection.jsx'
  'src__components__WujianSection.jsx'      = 'src/components/WujianSection.jsx'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ""
Write-Host "还原完成。重建：Remove-Item -Recurse -Force dist; npm run build" -ForegroundColor Cyan
