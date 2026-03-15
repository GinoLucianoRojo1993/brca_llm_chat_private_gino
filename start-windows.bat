@echo off
chcp 65001 >nul
title BCRA Chat

echo ============================================
echo   BCRA Chat - Iniciando servidor...
echo ============================================
echo.

:: Verificar .env.local
if not exist ".env.local" (
    echo [ERROR] No se encontró .env.local
    echo Ejecutá primero setup-windows.bat
    pause
    exit /b 1
)

:: Build de producción si no existe .next
if not exist ".next" (
    echo Compilando la aplicacion por primera vez...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Falló el build
        pause
        exit /b 1
    )
)

echo Iniciando BCRA Chat en http://localhost:3000
echo.
echo Presioná Ctrl+C para detener el servidor.
echo.

:: Abrir el browser automáticamente
start "" "http://localhost:3000"

:: Iniciar servidor
call npm start
