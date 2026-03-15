@echo off
chcp 65001 >nul
title BCRA Chat - Setup

echo ============================================
echo   BCRA Chat - Instalacion para Windows 11
echo ============================================
echo.

:: Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado.
    echo.
    echo Por favor instalalo desde: https://nodejs.org/
    echo Descargá la versión LTS y volvé a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
echo [OK] Node.js %NODE_VERSION% detectado

:: Instalar dependencias
echo.
echo Instalando dependencias (puede tardar unos minutos)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Falló npm install
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas

:: Verificar .env.local
if not exist ".env.local" (
    echo.
    echo [AVISO] No se encontró el archivo .env.local
    echo Creando archivo de configuracion...
    (
        echo ANTHROPIC_API_KEY=sk-ant-REEMPLAZAR-CON-TU-API-KEY
        echo ANTHROPIC_MODEL=claude-sonnet-4-6
        echo BCRA_API_BASE_URL=https://api.bcra.gob.ar
        echo BCRA_CENTRAL_DEUDORES_PREFIX=centraldedeudores
    ) > .env.local
    echo.
    echo [IMPORTANTE] Editá el archivo .env.local y reemplazá
    echo              ANTHROPIC_API_KEY con tu clave real de Anthropic.
    echo              Luego ejecutá start-windows.bat
    echo.
    pause
    exit /b 0
)

echo.
echo [OK] Configuracion encontrada
echo.
echo Setup completado. Ejecutá start-windows.bat para iniciar la app.
echo.
pause
