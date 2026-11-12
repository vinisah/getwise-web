@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1" %*
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar o Get Wise. Confira o erro acima.
  pause
  exit /b 1
)
endlocal
