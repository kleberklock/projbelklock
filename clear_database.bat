@echo off
title BelKlock - Limpeza do Banco de Dados
echo ==========================================================
echo           LIMPEZA COMPLETA DO BANCO DE DADOS
echo ==========================================================
echo.
echo ATENCAO: Esta acao ira excluir permanentemente todos os dados:
echo - Vendas (Diretas e de Revendedoras)
echo - Clientes
echo - Produtos
echo - Historicos de Acertos
echo - Revendedoras Cadastradas
echo.
echo Apenas a conta Administradora principal (admin@belklock.com / 0001) sera mantida.
echo.
set /p confirm="Digite 'SIM' e pressione Enter para confirmar a exclusao: "

if /i "%confirm%"=="SIM" (
    echo.
    echo Inciando a limpeza...
    cd server
    node clear_database.js
) else (
    echo.
    echo Operacao cancelada pelo usuario. Nenhum dado foi alterado.
)
echo.
pause
