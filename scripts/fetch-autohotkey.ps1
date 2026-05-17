$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$automationDir = Join-Path $root "resources\automation"
$exePath = Join-Path $automationDir "AutoHotkey64.exe"

if (Test-Path $exePath) {
  Write-Host "AutoHotkey64.exe already exists at $exePath"
  exit 0
}

New-Item -ItemType Directory -Force -Path $automationDir | Out-Null

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/AutoHotkey/AutoHotkey/releases/latest" -Headers @{
  "User-Agent" = "Macrodeck-build"
}

$asset = $release.assets |
  Where-Object { $_.name -match "^AutoHotkey_.*\.zip$" } |
  Select-Object -First 1

if (-not $asset) {
  throw "Could not find an AutoHotkey zip asset in the latest release."
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("macrodeck-ahk-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempDir $asset.name

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

try {
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -Headers @{
    "User-Agent" = "Macrodeck-build"
  }
  Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
  $downloadedExe = Get-ChildItem -Path $tempDir -Recurse -Filter "AutoHotkey64.exe" | Select-Object -First 1

  if (-not $downloadedExe) {
    throw "Downloaded archive did not contain AutoHotkey64.exe."
  }

  Copy-Item -Path $downloadedExe.FullName -Destination $exePath -Force
  Write-Host "Downloaded AutoHotkey64.exe to $exePath"
}
finally {
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
