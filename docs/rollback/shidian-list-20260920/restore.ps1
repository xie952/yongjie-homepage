# 回滚：十殿门卡片改版（纵向可滚层级列表）
# 用法：在项目根目录执行  powershell -ExecutionPolicy Bypass -File "docs/rollback/shidian-list-20260920/restore.ps1"
# 作用：把 ZhengshenSection.jsx 与 index.css 还原成改版前的版本；随后重新 build 即可。
$ErrorActionPreference = 'Stop'
$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$root   = Resolve-Path (Join-Path $here '..\..\..')
Copy-Item (Join-Path $here 'ZhengshenSection.jsx.bak') (Join-Path $root 'src\components\ZhengshenSection.jsx') -Force
Copy-Item (Join-Path $here 'index.css.bak')            (Join-Path $root 'src\index.css')                    -Force
Write-Host '[rollback] 已还原 ZhengshenSection.jsx 与 index.css'
Write-Host '[rollback] 接着执行： npm run build  &&  node serve-main.mjs'
