@echo off
title Conecta Joias - Visualizador de Banco de Dados (Prisma Studio)
echo ==========================================================
echo           ABRINDO O PRISMA STUDIO (BANCO DE DADOS)
echo ==========================================================
echo.
echo O Prisma Studio iniciara localmente.
echo O navegador abrira automaticamente em http://localhost:5555
echo.
echo IMPORTANTE: Deixe este terminal aberto enquanto navega nos dados.
echo Pressione Ctrl + C neste terminal para encerrar.
echo ==========================================================
echo.
cd server
npx prisma studio
pause
