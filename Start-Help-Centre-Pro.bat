@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   HelpCentre Pro - one-click local stack
echo ============================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found. Install Docker Desktop, then run this file again.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop is not running. Start it, wait until it is ready, then run this file again.
  pause
  exit /b 1
)

rem Docker publishes the API on 4008 and the frontend on 5173. If a local
rem "npm run dev" / "node server.js" already owns those ports, the containers
rem still start but logins fail with a bare 500 from the container's Vite proxy
rem ("Cannot reach the API"). Bail out early instead.
echo Checking ports 4008 and 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach($p in 4008,5173){$c=Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1;if($c){$n=(Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue).ProcessName;if($n -and $n -notmatch 'docker|wsl'){Write-Host ('  port '+$p+' is used by '+$n+' PID '+$c.OwningProcess);exit 1}}};exit 0"
if errorlevel 1 (
  echo.
  echo Those ports are already in use by a local dev server.
  echo.
  echo Keep using it:   open http://localhost:5173
  echo Or stop it first - npm run dev / node server.js - then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "FUMS-HELP-CENTER-PRO-main\FUMS-HELP-CENTER-PRO-main\.env" (
  echo Missing backend .env file.
  echo Expected: FUMS-HELP-CENTER-PRO-main\FUMS-HELP-CENTER-PRO-main\.env
  pause
  exit /b 1
)

echo Building and starting monolith stack + Frontend...
echo   backend, postgres, redis, frontend
echo.
docker compose up --build -d
if errorlevel 1 (
  echo.
  echo Startup failed. Scroll up for Docker errors.
  pause
  exit /b 1
)

echo.
echo Waiting for services...
timeout /t 20 /nobreak >nul

echo.
echo Ready:
echo   Frontend  http://localhost:5173
echo   Backend   http://localhost:4008
echo   Health    http://localhost:4008/health
echo   Swagger   http://localhost:4008/api-docs
echo.
echo Platform Admin portal:
echo   http://localhost:5173/admin/login
echo   ebube.okechukwu@primex360.com  /  2020/EN/12566
echo.
echo Tenant workspace login:
echo   http://localhost:5173/login
echo   admin@helpcentrepro.com  /  test
echo   amaka@primex360.com      /  2020/EN/12566
echo.
echo Tip: double-click Stop-Help-Centre-Pro.bat to stop everything.
echo.

start "" "http://localhost:5173"

pause
endlocal
