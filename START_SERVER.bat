@echo off
REM ════════════════════════════════════════════════════════════════
REM  Relatório Inteligente IA - Servidor Node.js + Proxy Groq
REM ════════════════════════════════════════════════════════════════

title Servidor Node.js - Relatório Inteligente IA

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   Iniciando servidor Node.js...                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Instala dependências se node_modules não existir
if not exist "node_modules" (
    echo  Instalando dependências (primeira execução)...
    npm install
    echo.
)

REM Inicia o servidor Node
node server.js

REM Mantém a janela aberta em caso de erro
if errorlevel 1 (
    echo.
    echo ❌ Erro: Node.js não está instalado ou não está no PATH
    echo    Baixe em: https://nodejs.org/
    echo.
    pause
)

