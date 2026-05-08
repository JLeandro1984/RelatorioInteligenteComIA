@echo off
setlocal

title Servidor Node.js - Relatorio Inteligente IA

cd /d "%~dp0"

echo.
echo ===============================================================
echo   Iniciando servidor Node.js...
echo ===============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado no PATH.
    echo        Instale em: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERRO] package.json nao encontrado nesta pasta.
    echo        Pasta atual: %CD%
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Instalando dependencias - primeira execucao...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERRO] Falha ao instalar dependencias.
        echo.
        pause
        exit /b 1
    )
    echo.
)

call npm start
if errorlevel 1 (
    echo.
    echo [ERRO] O servidor foi encerrado com falha.
    echo        Verifique as mensagens acima: porta em uso, .env, etc.
    echo.
    pause
    exit /b 1
)

exit /b 0

