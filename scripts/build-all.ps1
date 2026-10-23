$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
& node scripts/verify-game.cjs
if ($LASTEXITCODE -ne 0) { throw 'Story checks failed' }
& "$PSScriptRoot\optimize-assets.ps1"
& node scripts/build-web.cjs
if ($LASTEXITCODE -ne 0) { throw 'HTML build failed' }
& "$PSScriptRoot\build-windows.ps1"
& "$PSScriptRoot\build-android.ps1"
& "$PSScriptRoot\package-source.ps1"
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'dist') -File | Where-Object Extension -In '.exe','.apk','.html','.zip' | ForEach-Object {
    $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $($_.Name)"
} | Set-Content -LiteralPath (Join-Path $projectRoot 'dist\SHA256SUMS.txt') -Encoding utf8

