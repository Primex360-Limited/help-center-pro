@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   Push HelpCentre Pro to GitHub
echo ============================================
echo.

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo Not a git repository.
  pause
  exit /b 1
)

echo Current remotes:
git remote -v
echo.

REM Ensure ebubeprimex remote exists
git remote get-url ebubeprimex >nul 2>nul
if errorlevel 1 (
  echo Adding remote: ebubeprimex
  git remote add ebubeprimex https://github.com/ebubeprimex/Help_Center_Pro_webapp.git
) else (
  echo Remote ebubeprimex already configured.
)

echo.
echo Pushing branch master to ebubeprimex...
git push -u ebubeprimex master
if errorlevel 1 (
  echo.
  echo Push failed.
  echo Make sure:
  echo   1) Repo exists at https://github.com/ebubeprimex/Help_Center_Pro_webapp
  echo   2) You are signed into GitHub as ebubeprimex
  echo.
  pause
  exit /b 1
)

echo.
echo Also pushing to origin (Okechukwu2002)...
git push origin master
if errorlevel 1 (
  echo Origin push failed - ebubeprimex push already succeeded.
)

echo.
echo Done. Render will auto-deploy if the Blueprint is connected.
echo.
pause
endlocal
