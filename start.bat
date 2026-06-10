@echo off
title BelKlock Semijoias - Inicializador
echo ==========================================================
echo           INICIANDO BELKLOCK SEMIJOIAS (LOCAL)
echo ==========================================================
echo.
echo [1/3] Iniciando o servidor do Banco de Dados (Backend) na porta 5000...
start "BelKlock Backend" cmd /c "cd server && npm run dev"

echo [2/3] Iniciando o servidor Web (Frontend) na porta 8080...
start "BelKlock Frontend" cmd /c "npx http-server -p 8080"

echo [3/3] Aguardando inicializacao e abrindo o sistema no navegador...
timeout /t 3 /nobreak >nul
start http://localhost:8080

echo.
echo ==========================================================
echo Sistema pronto!
echo IMPORTANTE: Nao feche as janelas pretas (cmd) abertas.
echo Elas representam o banco de dados e o site rodando.
echo ==========================================================
echo.
pause
