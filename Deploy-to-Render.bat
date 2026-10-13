@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   HelpCentre Pro - Render hosting helper
echo ============================================
echo.
echo This opens the exact pages you need.
echo Follow the numbered steps in RENDER-HOSTING.txt
echo.

start "" "https://github.com/new?name=Help_Center_Pro_webapp&owner=ebubeprimex&visibility=private"
timeout /t 2 /nobreak >nul
start "" "https://dashboard.render.com/select-repo?type=blueprint"
timeout /t 1 /nobreak >nul
start "" "RENDER-HOSTING.txt"

echo.
echo Opened:
echo   1) Create GitHub repo under ebubeprimex
echo   2) Render Blueprint dashboard
echo   3) Step-by-step hosting guide
echo.
pause
endlocal
