@echo off
REM ════════════════════════════════════════════════════════════════
REM  Relatório Inteligente IA - Servidor Local
REM ════════════════════════════════════════════════════════════════

title Servidor HTTP - Relatório Inteligente IA

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   Iniciando servidor HTTP local...                           ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Obtém o diretório do script
cd /d "%~dp0"

REM Inicia o servidor Python
python -m http.server 8000

REM Caso o Python não seja encontrado, tenta python3
if errorlevel 1 (
    echo.
    echo ⚠️  Python não encontrado. Tentando python3...
    echo.
    python3 -m http.server 8000
)

REM Mantém a janela aberta em caso de erro
if errorlevel 1 (
    echo.
    echo ❌ Erro: Python não está instalado ou não está no PATH
    echo    Baixe em: https://www.python.org/
    echo.
    pause
)
