$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "Trader QA fallback starting..."
Write-Host "This fallback is for machines where npm is missing. It does not replace CI, but it checks syntax where Node works and verifies important UI/product files."

$npm = Get-Command npm -ErrorAction SilentlyContinue
$node = Get-Command node -ErrorAction SilentlyContinue
$npmOk = $false
$nodeOk = $false

if ($npm) {
  try {
    & $npm.Source --version *> $null
    $npmOk = ($LASTEXITCODE -eq 0)
  } catch {
    $npmOk = $false
  }
}

if ($node) {
  try {
    & $node.Source --version *> $null
    $nodeOk = ($LASTEXITCODE -eq 0)
  } catch {
    $nodeOk = $false
  }
}

if ($npmOk) {
  Write-Host "npm found. Running normal checks."
  npm test
  npm run release:manifest
  npm run test:smoke
  exit $LASTEXITCODE
}

Write-Host "npm is not available on PATH. Using fallback checks."

if ($nodeOk) {
  Write-Host "node found. Running syntax and UI smoke fallback."
  node tools/check-syntax.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node tools/browser-ui-smoke.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host "node is not available on PATH. Running PowerShell file checks only."
  $required = @(
    "index.html",
    "app.js",
    "onboarding-wizard.js",
    "paper-broker.js",
    "persistence-engine.js",
    "api/alpaca-paper.js",
    "api/persistence.js",
    "tools/browser-ui-smoke.mjs"
  )
  foreach ($file in $required) {
    if (!(Test-Path $file)) {
      Write-Error "Missing required file: $file"
      exit 1
    }
    Write-Host "OK file exists: $file"
  }
  $broker = Get-Content -Raw paper-broker.js
  $onboarding = Get-Content -Raw onboarding-wizard.js
  $api = Get-Content -Raw api/alpaca-paper.js
  if ($onboarding -notmatch "Paper and research only") { Write-Error "Missing first-run paper/research setup wizard"; exit 1 }
  if ($onboarding -notmatch "Do not show again") { Write-Error "Missing setup wizard dismissal control"; exit 1 }
  if ($broker -notmatch "Paper setup wizard") { Write-Error "Missing Alpaca setup wizard"; exit 1 }
  if ($api -notmatch "paper-api\.alpaca\.markets") { Write-Error "Missing paper-only Alpaca base check"; exit 1 }
}

Write-Host "QA fallback completed."
