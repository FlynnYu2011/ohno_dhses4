$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$webOutput = Join-Path $projectRoot '.build\web'
New-Item -ItemType Directory -Force -Path $webOutput | Out-Null
Add-Type -AssemblyName System.Drawing
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -EQ 'image/jpeg'
Get-ChildItem -LiteralPath $projectRoot -Filter '*.jpg' -File | ForEach-Object {
    $source = [System.Drawing.Image]::FromFile($_.FullName)
    try {
        $scale = [Math]::Min(1.0, 1600.0 / [Math]::Max($source.Width, $source.Height))
        $width = [Math]::Max(1, [int]($source.Width * $scale))
        $height = [Math]::Max(1, [int]($source.Height * $scale))
        $bitmap = New-Object System.Drawing.Bitmap($width, $height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($source, 0, 0, $width, $height)
            $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]88)
            $assetName = $_.Name -replace '^微信图片_', 'photo_'
            $bitmap.Save((Join-Path $webOutput $assetName), $jpegCodec, $parameters)
        } finally { $parameters.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    } finally { $source.Dispose() }
}
Write-Output 'Distribution photos resized to max 1600px; original files preserved.'

