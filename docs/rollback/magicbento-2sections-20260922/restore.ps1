# 回滚脚本 —— 征神之路 / 无间镖客 数据卡区接入 MagicBento（2026-09-22）
# 用法：项目根目录执行  pwsh -File docs/rollback/magicbento-2sections-20260922/restore.ps1
# 作用：把两个板块文件还原到接入前状态。components/MagicBento/ 是上一轮新增的复用资产，不还原。
#       执行后需重建 —— Remove-Item -Recurse -Force dist; npm run build

$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'src__components__ZhengshenSection.jsx' = 'src/components/ZhengshenSection.jsx'
  'src__components__WujianSection.jsx'    = 'src/components/WujianSection.jsx'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ""
Write-Host "还原完成。重建：Remove-Item -Recurse -Force dist; npm run build" -ForegroundColor Cyan
