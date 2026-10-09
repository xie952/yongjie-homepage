# 回滚脚本 —— 十殿门段位列表接入 React Bits AnimatedList（2026-09-22）
# 用法：项目根目录执行  pwsh -File docs/rollback/animated-list-20260922/restore.ps1
# 作用：还原 ZhengshenSection.jsx 与 index.css 到接入前状态。
# 注意：新增的 src/components/AnimatedList/ 目录不会被自动删除，回滚后如无引用可直接手动删除。
#       执行后需重建 —— Remove-Item -Recurse -Force dist; npm run build

$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'src__components__ZhengshenSection.jsx' = 'src/components/ZhengshenSection.jsx'
  'src__index.css'                        = 'src/index.css'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ""
Write-Host "还原完成。重建：Remove-Item -Recurse -Force dist; npm run build" -ForegroundColor Cyan
