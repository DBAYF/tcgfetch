# TCGFetch Windows Setup Script
# Run this script to set up the project on Windows

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "      TCGFetch v2.0 - Windows Setup Script" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   Some features may not work. Consider running as Admin." -ForegroundColor Yellow
    Write-Host ""
}

# Check Node.js
Write-Host "🔍 Checking Node.js..." -ForegroundColor Green
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js not found!" -ForegroundColor Red
    Write-Host "   Please install from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check npm
Write-Host "🔍 Checking npm..." -ForegroundColor Green
try {
    $npmVersion = npm --version
    Write-Host "   ✅ npm installed: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm not found!" -ForegroundColor Red
    exit 1
}

# Check Git
Write-Host "🔍 Checking Git..." -ForegroundColor Green
try {
    $gitVersion = git --version
    Write-Host "   ✅ Git installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Git not found!" -ForegroundColor Red
    Write-Host "   Please install from: https://git-scm.com/" -ForegroundColor Yellow
    exit 1
}

# Check Python (for node-gyp)
Write-Host "🔍 Checking Python..." -ForegroundColor Green
try {
    $pythonVersion = python --version
    Write-Host "   ✅ Python installed: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Python not found (may cause issues with native modules)" -ForegroundColor Yellow
    Write-Host "   Install from: https://www.python.org/" -ForegroundColor Yellow
}

# Check disk space
Write-Host "🔍 Checking disk space..." -ForegroundColor Green
$drive = Get-PSDrive -Name C
$freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
if ($freeSpaceGB -lt 60) {
    Write-Host "   ⚠️  Low disk space: $freeSpaceGB GB free" -ForegroundColor Yellow
    Write-Host "   Recommended: 60GB+ free space" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Disk space available: $freeSpaceGB GB" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "      Installing Dependencies" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Clean previous installation
if (Test-Path "node_modules") {
    Write-Host "🧹 Cleaning previous installation..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
}

if (Test-Path "package-lock.json") {
    Remove-Item package-lock.json -ErrorAction SilentlyContinue
}

# Install dependencies
Write-Host "📦 Installing npm packages (this may take 5-10 minutes)..." -ForegroundColor Green
Write-Host "   Compiling native modules for Windows..." -ForegroundColor Yellow
Write-Host ""

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Installation failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common solutions:" -ForegroundColor Yellow
    Write-Host "1. Install Visual C++ Build Tools:" -ForegroundColor Yellow
    Write-Host "   https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Install Python:" -ForegroundColor Yellow
    Write-Host "   https://www.python.org/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Install windows-build-tools:" -ForegroundColor Yellow
    Write-Host "   npm install --global windows-build-tools" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "      Building TypeScript Project" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "      ✅ Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Ready to download TCG data!" -ForegroundColor Green
Write-Host ""
Write-Host "Quick Start Commands:" -ForegroundColor Cyan
Write-Host "  npm start              # Download all API-based games" -ForegroundColor White
Write-Host "  npm run download:yugioh    # Download Yu-Gi-Oh only" -ForegroundColor White
Write-Host "  npm run download:mtg       # Download Magic: The Gathering" -ForegroundColor White
Write-Host "  npm run download:pokemon   # Download Pokémon TCG" -ForegroundColor White
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  `$env:CONCURRENCY=30   # Set parallel downloads" -ForegroundColor White
Write-Host "  npm start" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  README.md              # Full documentation" -ForegroundColor White
Write-Host "  WINDOWS_SETUP.md       # Windows-specific guide" -ForegroundColor White
Write-Host "  PRODUCTION_FEATURES.md # Production features" -ForegroundColor White
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# Create convenient batch files
Write-Host "📝 Creating shortcut batch files..." -ForegroundColor Green

@"
@echo off
echo Starting TCGFetch...
npm start
pause
"@ | Out-File -FilePath "run-downloader.bat" -Encoding ASCII

@"
@echo off
echo Starting Yu-Gi-Oh downloader...
npm run download:yugioh
pause
"@ | Out-File -FilePath "run-yugioh.bat" -Encoding ASCII

@"
@echo off
echo Validating downloaded data...
npm run validate
pause
"@ | Out-File -FilePath "validate-data.bat" -Encoding ASCII

Write-Host "   ✅ Created run-downloader.bat" -ForegroundColor Green
Write-Host "   ✅ Created run-yugioh.bat" -ForegroundColor Green
Write-Host "   ✅ Created validate-data.bat" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tip: Double-click .bat files to run without PowerShell" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ready to go! Type 'npm start' to begin downloading." -ForegroundColor Green
Write-Host ""

