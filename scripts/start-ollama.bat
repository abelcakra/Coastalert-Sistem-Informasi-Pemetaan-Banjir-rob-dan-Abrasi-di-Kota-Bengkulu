@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ollama-serve.ps1" %*
if errorlevel 1 pause
endlocal
