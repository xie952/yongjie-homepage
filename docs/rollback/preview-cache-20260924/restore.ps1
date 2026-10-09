# 回滚脚本 —— 预览服务器缓存策略 + 页脚日期口径修复（2026-09-24）
# 用法：项目根目录执行  pwsh -File docs/rollback/preview-cache-20260924/restore.ps1
# 作用：把 serve-main.mjs 与 src/components/ContactSection.jsx 还原到本次改动前的状态。
#       执行后必须重建 —— Remove-Item -Recurse -Force dist; npm run build
#       并且【重启 5175 预览服务器】：服务器自身的代码改动只在重启后生效。

$ErrorActionPreference = 'Stop'
$bak  = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$map = @{
  'serve-main.mjs'                      = 'serve-main.mjs'
  'src__components__ContactSection.jsx' = 'src/components/ContactSection.jsx'
}
foreach ($k in $map.Keys) {
  $src = Join-Path $bak $k
  if (-not (Test-Path $src)) { Write-Host "[skip] 备份缺失: $k" -ForegroundColor Yellow; continue }
  Copy-Item $src (Join-Path $root $map[$k]) -Force
  Write-Host "[ok]   已还原 $($map[$k])" -ForegroundColor Green
}
Write-Host ""
Write-Host "还原完成。重建：Remove-Item -Recurse -Force dist; npm run build；然后重启 5175 服务器。" -ForegroundColor Cyan
