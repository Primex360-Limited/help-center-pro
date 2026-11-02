$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "============================================"
Write-Host "  HelpCentre Pro - one-click local stack"
Write-Host "============================================"
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker was not found. Install Docker Desktop first."
    exit 1
}

try {
    docker info | Out-Null
} catch {
    Write-Host "Docker Desktop is not running. Start it, then run this script again."
    exit 1
}

# Docker publishes the API on 4008 and the frontend on 5173. If a local
# "npm run dev" / "node server.js" already owns those ports, the containers
# still start but logins fail with a bare 500 from the container's Vite proxy
# ("Cannot reach the API").
$busy = @()
foreach ($port in 4008, 5173) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $listener) { continue }
    $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if (-not $proc) { continue }
    if ($proc.ProcessName -match 'docker|wsl') { continue }
    $busy += "  port $port -> $($proc.ProcessName) (PID $($proc.Id))"
}

if ($busy.Count -gt 0) {
    Write-Host ""
    Write-Host "These ports are already in use by a local dev server:" -ForegroundColor Yellow
    $busy | ForEach-Object { Write-Host $_ }
    Write-Host ""
    Write-Host "Keep using your local servers: open http://localhost:5173"
    Write-Host "Or stop them (frontend: npm run dev, backend: node server.js) and run this again."
    exit 1
}

$envPath = Join-Path $PSScriptRoot "FUMS-HELP-CENTER-PRO-main\FUMS-HELP-CENTER-PRO-main\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "Missing backend .env at $envPath"
    exit 1
}

Write-Host "Building and starting Postgres, Redis, API, and Frontend..."
docker compose up --build -d

Write-Host ""
Write-Host "Waiting for services..."
Start-Sleep -Seconds 12

Write-Host ""
Write-Host "Ready:"
Write-Host "  Frontend  http://localhost:5173"
Write-Host "  Backend   http://localhost:4008"
Write-Host "  Swagger   http://localhost:4008/api-docs"
Write-Host ""
Write-Host "Platform Admin portal:"
Write-Host "  http://localhost:5173/admin/login"
Write-Host "  ebube.okechukwu@primex360.com  /  2020/EN/12566"
Write-Host ""
Write-Host "Tenant workspace login:"
Write-Host "  http://localhost:5173/login"
Write-Host "  admin@helpcentrepro.com  /  test"
Write-Host "  amaka@primex360.com      /  2020/EN/12566"
Write-Host ""


Start-Process "http://localhost:5173"
