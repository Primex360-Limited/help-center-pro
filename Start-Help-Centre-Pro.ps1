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
