$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$toolsRoot = Join-Path $projectRoot '.build-tools'
$jdk = Get-ChildItem -LiteralPath (Join-Path $toolsRoot 'jdk17') -Directory | Select-Object -First 1
$androidTools = Join-Path $toolsRoot 'android-build-tools\android-15'
$androidJar = Join-Path $toolsRoot 'android-platform\android-35\android.jar'
if (!$jdk -or !(Test-Path -LiteralPath $androidJar)) { throw 'Run scripts/setup-build-tools.ps1 first' }
$env:JAVA_HOME = $jdk.FullName
$env:PATH = (Join-Path $jdk.FullName 'bin') + ';' + $env:PATH
$work = Join-Path $projectRoot '.build\android'
New-Item -ItemType Directory -Force -Path "$work\classes", "$work\dex" | Out-Null
function Check-BuildStep([string]$step) { if ($LASTEXITCODE -ne 0) { throw "$step failed ($LASTEXITCODE)" } }
& "$jdk\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -bootclasspath $androidJar -d "$work\classes" packaging\android\src\com\dhses4\campus\MainActivity.java
Check-BuildStep 'javac'
& "$jdk\bin\jar.exe" cf "$work\classes.jar" -C "$work\classes" .
Check-BuildStep 'jar'
& "$androidTools\d8.bat" --lib $androidJar --min-api 26 --output "$work\dex" "$work\classes.jar"
Check-BuildStep 'd8'
$unsigned = Join-Path $work 'unsigned.apk'
& "$androidTools\aapt.exe" package -f -M packaging\android\AndroidManifest.xml -S packaging\android\res -I $androidJar -A .build\web -F $unsigned
Check-BuildStep 'aapt'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($unsigned, [System.IO.Compression.ZipArchiveMode]::Update)
try { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$work\dex\classes.dex", 'classes.dex') | Out-Null } finally { $zip.Dispose() }
& "$androidTools\zipalign.exe" -f 4 $unsigned "$work\aligned.apk"
Check-BuildStep 'zipalign'
$key = Join-Path $toolsRoot 'dhses4-local.keystore'
if (!(Test-Path -LiteralPath $key)) {
    & "$jdk\bin\keytool.exe" -genkeypair -keystore $key -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Dhses4 Local Build, O=Dhses4, C=CN'
    Check-BuildStep 'keytool'
}
$apk = Join-Path $projectRoot 'dist\ohno_dhses4.apk'
& "$androidTools\apksigner.bat" sign --ks $key --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $apk "$work\aligned.apk"
Check-BuildStep 'apksigner sign'
& "$androidTools\apksigner.bat" verify --verbose $apk
Check-BuildStep 'apksigner verify'
& "$androidTools\aapt.exe" dump badging $apk | Select-Object -First 7
Check-BuildStep 'APK manifest check'
Write-Output "Built $apk (local test signing key)"
