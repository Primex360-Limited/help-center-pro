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

if not exist "FUMS-HELP-CENTER-PRO-main\FUMS-HELP-CENTER-PRO-main\.env" (
  echo Missing backend .env file.
  echo Expected: FUMS-HELP-CENTER-PRO-main\FUMS-HELP-CENTER-PRO-main\.env
  pause
  exit /b 1
)

echo Building and starting Postgres, Redis, API, and Frontend...
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
timeout /t 12 /nobreak >nul

echo.
echo Ready:
echo   Frontend  http://localhost:5173
echo   Backend   http://localhost:4008
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
