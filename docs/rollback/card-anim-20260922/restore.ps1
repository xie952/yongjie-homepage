# 回滚脚本 —— 卡片动效（P0 翻面 / P1 变量呼吸 / P2 光环外扩）
# 建立时间：2026-09-22 23:41
# 用法：在项目根目录执行  pwsh -File docs/rollback/card-anim-20260922/restore.ps1
# 作用：把 4 个被改动的文件还原到动效实施【之前】的状态。
# 注意：只还原下列文件，不影响其它文件；执行后需重新 npm run build。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$bak  = $PSScriptRoot

$map = @{
  'src__index.css'                   = 'src/index.css'
  'src__components__HeroCard.jsx'    = 'src/components/HeroCard.jsx'
  'src__components__WeaponCard.jsx'  = 'src/components/WeaponCard.jsx'
  'src__lib__fx.js'                  = 'src/lib/fx.js'
}

foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  $dst = Join-Path $root $map[$k]
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src $dst -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ""
Write-Host "全部还原完成。请重新构建：Remove-Item -Recurse -Force dist; npm run build" -ForegroundColor Cyan
