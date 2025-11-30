@echo off
:: TCGFetch Windows Launcher
:: This script runs the TCG data downloader

echo.
echo ========================================
echo   TCGFetch v2.0 - Data Downloader
echo ========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Error: Dependencies not installed!
    echo Please run: setup-windows.ps1
    echo.
    pause
    exit /b 1
)

:: Check if built
if not exist "dist" (
    echo Building project...
    call npm run build
)

:: Run the downloader
echo Starting download...
echo.
call npm start

echo.
echo Download complete!
pause

