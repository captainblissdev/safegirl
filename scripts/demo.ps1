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

  -Kb 21 (the default) is the 21-entry base with the 0.8439 gate, as
  above. -Kb 62 selects the 62-entry configuration, for both parts:
    .\scripts\demo.ps1 -Part ml      -Kb 62   # terminal 1
    .\scripts\demo.ps1 -Part gateway -Kb 62   # terminal 2
  It turns V4 triage on (-Mode off is refused) and sets, for ml_service,
  KB_PATH=./knowledge_base_kb62.json and RETRIEVAL_EMBED_MODE=question,
  and for the gateway KB_SET=kb62 and GATE_G_ENABLED=true (gate (g)). The
  interface is started with VITE_KB_SET=kb62. -Kb 21 sets the same
  variables to their defaults. Using -Kb 62 in the demo needs its own
  decision-log entry (KB sign-off and Mr. Ouma's decision).

  -ShowConfig prints the variables a part would set and exits.

  The gateway is started exactly as the README says
  (node --env-file=.env server.js); authentication is unchanged.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet("ml", "gateway")][string]$Part,
  [ValidateSet("off", "on")][string]$Mode = "off",
  [ValidateSet("21", "62")][string]$Kb = "21",
  [switch]$Offline,
  [switch]$Check,
  [switch]$ShowConfig
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

# -Kb 62 is the 62-entry configuration: V4 on, gate (g), the 62 approved
# entries, question embed mode. It needs V4, so -Mode off is refused.
$kb62 = $Kb -eq "62"
if ($kb62 -and $PSBoundParameters.ContainsKey("Mode") -and $Mode -ne "on") {
  Write-Host "-Kb 62 needs V4 triage on: use -Mode on or leave -Mode out."
  exit 2
}
if ($kb62) { $Mode = "on" }
$flag = if ($Mode -eq "on") { "true" } else { "false" }
$env:V4_TRIAGE_ENABLED = $flag

# Set both ways, so the printed configuration is the one that runs even if
# the gateway's .env names another (process variables take precedence).
$kbJson = if ($kb62) { "knowledge_base_kb62.json" } else { "knowledge_base.json" }
$embedMode = if ($kb62) { "question" } else { "full" }
$kbSet = if ($kb62) { "kb62" } else { "kb21" }
$gateG = if ($kb62) { "true" } else { "false" }

$kbFile = Join-Path $repo "ml_service\$kbJson"
$kbEntries = (Get-Content -Raw -Encoding UTF8 $kbFile | ConvertFrom-Json).Count
$label = if ($Mode -eq "on") { "ON (V4 triage)" } else { "OFF (V3, today's behaviour)" }
$gateLabel = if ($kb62) { "gate (g)" } else { "relevance gate 0.8439" }

Write-Host "SafeGirl demo: $Part, V4 triage $label; V4_TRIAGE_ENABLED=$flag"
Write-Host "Knowledge base: $kbEntries entries in ml_service\$kbJson; $gateLabel"

if ($ShowConfig) {
  if ($Part -eq "ml") {
    Write-Host "CONFIG ml V4_TRIAGE_ENABLED=$flag KB_PATH=./$kbJson RETRIEVAL_EMBED_MODE=$embedMode"
  } else {
    Write-Host "CONFIG gateway V4_TRIAGE_ENABLED=$flag KB_SET=$kbSet GATE_G_ENABLED=$gateG"
  }
  if ($kb62) {
    Write-Host "Interface: start it with VITE_KB_SET=kb62 so it bundles the 62-entry copies."
  }
  exit 0
}

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
  $env:KB_PATH = "./$kbJson"
  $env:RETRIEVAL_EMBED_MODE = $embedMode
  Write-Host "Starting ml_service on 127.0.0.1:8001; wait for 'Application startup complete'."
  Set-Location (Join-Path $repo "ml_service")
  & "..\.venv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8001
} else {
  Set-Location (Join-Path $repo "app\gateway")
  $env:KB_SET = $kbSet
  $env:GATE_G_ENABLED = $gateG
  if ($kb62) {
    Write-Host "Interface: start it with VITE_KB_SET=kb62 so it bundles the 62-entry copies."
  }
  $served = node -e "const {loadKnowledgeBase}=require('./src/retrievalModule');console.log(Object.values(loadKnowledgeBase()).flat().length)"
  Write-Host "Gateway: $served knowledge-base entries served"
  Write-Host "Starting the gateway (node --env-file=.env server.js)."
  node --env-file=.env server.js
}
