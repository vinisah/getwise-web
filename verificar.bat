@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   VERIFICACAO Get Wise (porteiro de bugs)
echo ============================================
echo.

echo [1/4] Tipos (TypeScript)...
call npx tsc --noEmit
if errorlevel 1 goto fail_tipos
echo    OK - sem erro de tipo.
echo.

echo [2/4] Testes automatizados...
call npm run test
if errorlevel 1 goto fail_teste
echo    OK - todos os testes passaram.
echo.

echo [3/4] Lint (estilo/qualidade) - informativo...
call npm run lint >nul 2>&1
if errorlevel 1 (echo    AVISO: ha apontamentos de lint - divida conhecida, NAO bloqueia. Detalhe: npm run lint) else (echo    OK)
echo.

echo [4/4] Formatacao (Prettier) - informativo...
call npm run format:check >nul 2>&1
if errorlevel 1 (echo    AVISO: arquivos fora do padrao - NAO bloqueia. Corrigir: npm run format) else (echo    OK)
echo.

echo ============================================
echo   TUDO OK
echo   Tipos e Testes verdes = sem o tipo de bug que a maquina pega.
echo   Avisos de lint/formato acima NAO impedem subir.
echo ============================================
exit /b 0

:fail_tipos
echo.
echo ============================================
echo   FALHOU em: TIPOS
echo   Ha erro de tipo no codigo. NAO suba a mudanca.
echo   Copie o erro acima e mostre ao Claude/dev.
echo ============================================
exit /b 1

:fail_teste
echo.
echo ============================================
echo   FALHOU em: TESTES
echo   Algum teste automatizado quebrou. NAO suba a mudanca.
echo   Copie o erro acima e mostre ao Claude/dev.
echo ============================================
exit /b 1
