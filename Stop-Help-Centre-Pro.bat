@echo off
cd /d "%~dp0"
echo Stopping HelpCentre Pro stack...
docker compose down
echo Done.
pause
