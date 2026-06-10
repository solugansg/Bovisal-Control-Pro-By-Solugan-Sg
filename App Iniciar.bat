@echo off
title BoviSal Control Pro - By Solugan SG
color 0A
echo.
echo  =====================================================
echo   BOVISAL CONTROL PRO - By Solugan SG  V 260610.7
echo  =====================================================
echo.
echo  Iniciando servidor local...
echo.

:: Verificar si Node/npx disponible
where npx >nul 2>&1
if %errorlevel%==0 (
    echo  Usando npx serve...
    echo  Abre tu navegador en: http://localhost:3000
    echo.
    start "" "http://localhost:3000"
    npx serve . -p 3000
    goto :fin
)

:: Alternativa: Python
where python >nul 2>&1
if %errorlevel%==0 (
    echo  Usando Python HTTP Server...
    echo  Abre tu navegador en: http://localhost:8000
    echo.
    start "" "http://localhost:8000"
    python -m http.server 8000
    goto :fin
)

:: Fallback: abrir directamente
echo  No se encontro servidor. Abriendo directamente en el navegador...
echo  NOTA: Algunas funciones pueden no operar sin servidor HTTP.
echo.
start "" "%~dp0index.html"

:fin
echo.
pause
