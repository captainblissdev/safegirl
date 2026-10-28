<#
.SYNOPSIS
  Start one SafeGirl demo process (ml_service or the gateway) with V4
  triage off (the default, today's behaviour: V3) or on.

.DESCRIPTION
  A thin wrapper around the commands in README "5. Start the three
  processes"; nothing else changes. Run it once per terminal, with the
  same -Mode for both parts:

    .\scripts\demo.ps1 -Part ml      -Mode off   # terminal 1
    .\scripts\demo.ps1 -Part gateway -Mode off   # terminal 2

  -Mode on sets V4_TRIAGE_ENABLED=true for the process; -Mode off sets it
  to "false" (anything but exactly "true" is off). The variable is set in
  the process environment, which takes precedence over the gateway's
  .env file, so the printed mode is the mode that runs. The flag-on mode
  is the configuration measured as arm A in the KB scale validation
  test: the 21-entry base, full embed mode, the 0.8439 relevance gate,
  V4 triage on.

  -Offline sets HF_HUB_OFFLINE=1 for ml_service, so the cached e5 model is
  used without contacting the Hugging Face hub.

  -Check only prints the mode and ml_service's /health, without starting
  anything.

  The gateway is started exactly as the README says
  (node --env-file=.env server.js); authentication is unchanged.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet("ml", "gateway")][string]$Part,
  [ValidateSet("off", "on")][string]$Mode = "off",
  [switch]$Offline,
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$flag = if ($Mode -eq "on") { "true" } else { "false" }
$env:V4_TRIAGE_ENABLED = $flag

$kbFile = Join-Path $repo "ml_service\knowledge_base.json"
$kbEntries = (Get-Content -Raw -Encoding UTF8 $kbFile | ConvertFrom-Json).Count
$label = if ($Mode -eq "on") { "ON (V4 triage)" } else { "OFF (V3, today's behaviour)" }

Write-Host "SafeGirl demo: $Part, V4 triage $label; V4_TRIAGE_ENABLED=$flag"
Write-Host "Knowledge base: $kbEntries entries in ml_service\knowledge_base.json"

if ($Check) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -TimeoutSec 5
    Write-Host ("ml_service /health: " + ($health | ConvertTo-Json -Compress))
  } catch {
    Write-Host "ml_service /health: not reachable"
  }
  exit 0
}

if ($Part -eq "ml") {
  if ($Offline) {
    $env:HF_HUB_OFFLINE = "1"
    Write-Host "Offline: HF_HUB_OFFLINE=1 (cached models only)"
  }
  $env:MODEL_DIR = "./final"
  $env:KB_PATH = "./knowledge_base.json"
  Write-Host "Starting ml_service on 127.0.0.1:8001; wait for 'Application startup complete'."
  Set-Location (Join-Path $repo "ml_service")
  & "..\.venv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8001
} else {
  Set-Location (Join-Path $repo "app\gateway")
  $served = node -e "const {loadKnowledgeBase}=require('./src/retrievalModule');console.log(Object.values(loadKnowledgeBase()).flat().length)"
  Write-Host "Gateway: $served knowledge-base entries served"
  Write-Host "Starting the gateway (node --env-file=.env server.js)."
  node --env-file=.env server.js
}
