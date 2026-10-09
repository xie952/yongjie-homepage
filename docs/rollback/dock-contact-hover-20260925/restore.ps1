# 回滚脚本 —— 手机端导航居中 / 联系卡统一 / 轮播卡 hover（2026-09-25）
# 用法：项目根目录执行  pwsh -File docs/rollback/dock-contact-hover-20260925/restore.ps1
# 作用：还原 index.css / ContactSection.jsx / LoadoutCarousel.css / fx.js 到本次修改前。
#       执行后必须重建：Remove-Item -Recurse -Force dist; npm run build
$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'index.css.bak'           = 'src/index.css'
  'ContactSection.jsx.bak'  = 'src/components/ContactSection.jsx'
  'LoadoutCarousel.css.bak' = 'src/components/LoadoutCarousel/LoadoutCarousel.css'
  'fx.js.bak'               = 'src/lib/fx.js'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ''
Write-Host '还原完成。重建：Remove-Item -Recurse -Force dist; npm run build' -ForegroundColor Cyan
