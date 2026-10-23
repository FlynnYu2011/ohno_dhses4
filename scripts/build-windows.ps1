$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
Add-Type -AssemblyName System.IO.Compression.FileSystem
$web = Join-Path $projectRoot '.build\web'
$sdk = Join-Path $projectRoot '.build-tools\webview2'
$licenseDirectory = Join-Path $web 'licenses'
New-Item -ItemType Directory -Force -Path $licenseDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $sdk 'LICENSE.txt') -Destination (Join-Path $licenseDirectory 'WebView2-LICENSE.txt') -Force
Copy-Item -LiteralPath (Join-Path $sdk 'NOTICE.txt') -Destination (Join-Path $licenseDirectory 'WebView2-NOTICE.txt') -Force
$gameZip = Join-Path $projectRoot '.build\windows-game.zip'
if (Test-Path -LiteralPath $gameZip) { Remove-Item -LiteralPath $gameZip }
[System.IO.Compression.ZipFile]::CreateFromDirectory($web, $gameZip)
$core = Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'
$forms = Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'
$loader = Join-Path $sdk 'runtimes\win-x64\native\WebView2Loader.dll'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$exe = Join-Path $projectRoot 'dist\ohno_dhses4.exe'
& $csc /nologo /target:winexe /platform:x64 /optimize+ "/out:$exe" "/win32manifest:$projectRoot\packaging\windows\app.manifest" "/resource:$gameZip,Game.zip" "/resource:$core,Microsoft.Web.WebView2.Core.dll" "/resource:$forms,Microsoft.Web.WebView2.WinForms.dll" "/resource:$loader,WebView2Loader.dll" "/reference:$core" "/reference:$forms" /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll packaging\windows\Program.cs
if ($LASTEXITCODE -ne 0) { throw 'Windows compilation failed' }
$verifyDirectory = Join-Path $projectRoot '.build\windows-verify'
$check = Start-Process -FilePath $exe -ArgumentList @('--verify', ('"' + $verifyDirectory + '"')) -WindowStyle Hidden -Wait -PassThru
if ($check.ExitCode -ne 0 -or !(Test-Path -LiteralPath (Join-Path $verifyDirectory 'verification.txt'))) { throw 'EXE extraction verification failed' }
Get-Content -LiteralPath (Join-Path $verifyDirectory 'verification.txt')
Write-Output "Built $exe"

