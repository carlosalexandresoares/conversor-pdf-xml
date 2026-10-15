@echo off
setlocal
title Conversor PDF para XML
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado neste computador.
  echo Instale o Node.js 24 LTS com a opcao de adicionar ao PATH.
  echo Download: https://nodejs.org/
  echo Depois, feche esta janela e abra INICIAR.bat novamente.
  pause
  popd
  exit /b 1
)
node iniciar.cjs
set "resultado=%errorlevel%"
if not "%resultado%"=="0" echo Nao foi possivel iniciar. Confira a mensagem acima.
pause
popd
exit /b %resultado%
