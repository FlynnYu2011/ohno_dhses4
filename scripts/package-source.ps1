$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sourceRoot = Join-Path $projectRoot '.build\github-source'
New-Item -ItemType Directory -Force -Path $sourceRoot | Out-Null
foreach ($file in @('dhses4.html', 'README.md', '.gitignore', 'CG_NOTES.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $sourceRoot -Force
}
foreach ($directory in @('scripts', 'packaging', '.github')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $directory) -Destination $sourceRoot -Recurse -Force
}
$assets = Get-Content -Raw -LiteralPath (Join-Path $projectRoot '.build\web-assets.json') | ConvertFrom-Json
foreach ($asset in $assets) {
    $stagedName = $asset -replace '^微信图片_', 'photo_'
    Copy-Item -LiteralPath (Join-Path $projectRoot ".build\web\$stagedName") -Destination (Join-Path $sourceRoot $asset) -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $projectRoot 'dist\ohno_dhses4-source.zip'
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip }
[System.IO.Compression.ZipFile]::CreateFromDirectory($sourceRoot, $zip)
Write-Output "Upload-ready source: $sourceRoot"
Write-Output "Source archive: $zip"
