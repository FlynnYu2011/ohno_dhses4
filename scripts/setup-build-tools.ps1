$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path $PSScriptRoot -Parent
$toolDir = Join-Path $projectRoot '.build-tools'
New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
function Download([string]$url, [string]$name) {
    $target = Join-Path $toolDir $name
    if (!(Test-Path -LiteralPath $target)) { Invoke-WebRequest -Uri $url -OutFile $target -TimeoutSec 600 }
    return $target
}
function Check-Hash([string]$file, [string]$algorithm, [string]$expected) {
    if ((Get-FileHash -LiteralPath $file -Algorithm $algorithm).Hash -ne $expected) { throw "Checksum mismatch: $file" }
}
$jdk = Download 'https://aka.ms/download-jdk/microsoft-jdk-17.0.20.1-windows-x64.zip' 'jdk17.zip'
$jdkHash = Download 'https://aka.ms/download-jdk/microsoft-jdk-17.0.20.1-windows-x64.zip.sha256sum.txt' 'jdk17.sha256.txt'
Check-Hash $jdk 'SHA256' (((Get-Content -Raw -LiteralPath $jdkHash).Trim() -split '\s+')[0])
$buildTools = Download 'https://dl.google.com/android/repository/build-tools_r35_windows.zip' 'android-build-tools.zip'
Check-Hash $buildTools 'SHA1' 'af059bb67cf7786f45ee0db85e2d24985df1b4b6'
$platform = Download 'https://dl.google.com/android/repository/platform-35_r02.zip' 'android-platform.zip'
Check-Hash $platform 'SHA1' '0bb560a90a7a2cbd0dd8348224d518b638fe7949'
$webviewVersion = '1.0.4314.35'
$webview = Download "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$webviewVersion/microsoft.web.webview2.$webviewVersion.nupkg" 'webview2.zip'
foreach ($pair in @(@($jdk,'jdk17'), @($buildTools,'android-build-tools'), @($platform,'android-platform'), @($webview,'webview2'))) {
    Expand-Archive -LiteralPath $pair[0] -DestinationPath (Join-Path $toolDir $pair[1]) -Force
}
Write-Output 'Project-local build tools ready. No system SDK installation changed.'

