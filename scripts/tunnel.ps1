# Publica somente o servidor HTTP OAuth2, nunca arquivos do projeto.
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectPath
$toolDirectory = Join-Path $projectPath '.tools'
New-Item -ItemType Directory -Force -Path $toolDirectory | Out-Null
$executablePath = Join-Path $toolDirectory 'cloudflared.exe'
if (-not (Test-Path -LiteralPath $executablePath)) {
  Write-Host 'Baixando cloudflared do repositório oficial...'
  $releaseInfo = Invoke-RestMethod 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest'
  $asset = $releaseInfo.assets | Where-Object name -eq 'cloudflared-windows-amd64.exe' | Select-Object -First 1
  if (-not $asset -or $asset.digest -notmatch '^sha256:([a-f0-9]{64})$') { throw 'Checksum oficial indisponível; instalação interrompida.' }
  $expectedHash = $Matches[1]
  $downloadPath = Join-Path $toolDirectory 'cloudflared.download'
  if (-not (Test-Path -LiteralPath $downloadPath)) { Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $downloadPath -TimeoutSec 180 }
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($downloadPath)
  try { $actualHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() } finally { $stream.Dispose(); $sha.Dispose() }
  if ($actualHash -ne $expectedHash) { throw 'Checksum não corresponde ao arquivo oficial.' }
  Move-Item -LiteralPath $downloadPath -Destination $executablePath
}
$oauthPort = & node --input-type=module -e "import 'dotenv/config'; console.log(process.env.PORT || '3001')"
if ($oauthPort -notmatch '^\d{1,5}$' -or [int]$oauthPort -lt 1 -or [int]$oauthPort -gt 65535) { throw 'PORT invalida no .env.' }
Write-Host 'Mantenha este terminal aberto. O link temporario muda a cada execucao.'
& $executablePath tunnel --url "http://127.0.0.1:$oauthPort" --no-autoupdate