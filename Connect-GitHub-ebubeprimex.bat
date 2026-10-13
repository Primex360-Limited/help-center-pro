@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   Connect GitHub account: ebubeprimex
echo ============================================
echo.
echo A browser window will open. Sign in as ebubeprimex.
echo.

where gh >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI not found in PATH.
  echo Re-open this terminal after installing GitHub CLI, or run:
  echo   winget install --id GitHub.cli -e
  pause
  exit /b 1
)

gh auth login --hostname github.com --git-protocol https --web
if errorlevel 1 (
  echo Login failed.
  pause
  exit /b 1
)

echo.
echo Creating repo ebubeprimex/Help_Center_Pro_webapp if missing...
gh repo view ebubeprimex/Help_Center_Pro_webapp >nul 2>nul
if errorlevel 1 (
  gh repo create ebubeprimex/Help_Center_Pro_webapp --private --source=. --remote=ebubeprimex --push
) else (
  echo Repo already exists. Configuring remote and pushing...
  git remote get-url ebubeprimex >nul 2>nul
  if errorlevel 1 (
    git remote add ebubeprimex https://github.com/ebubeprimex/Help_Center_Pro_webapp.git
  )
  git push -u ebubeprimex master
)

echo.
echo Configuring origin to push to BOTH accounts on every git push origin...
git remote set-url origin https://github.com/Okechukwu2002/Help_Center_Pro_webapp.git
git remote set-url --add --push origin https://github.com/Okechukwu2002/Help_Center_Pro_webapp.git
git remote set-url --add --push origin https://github.com/ebubeprimex/Help_Center_Pro_webapp.git

echo.
echo Current remotes:
git remote -v
echo.
echo Done.
echo Next: double-click Deploy-to-Render.bat
echo.
pause
endlocal
