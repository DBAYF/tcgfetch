# Windows Setup Guide for TCGFetch

## Prerequisites

### 1. Install Node.js
- Download from: https://nodejs.org/
- Install LTS version (20.x or later)
- Verify installation:
```powershell
node --version
npm --version
```

### 2. Install Git
- Download from: https://git-scm.com/download/win
- Use default installation settings
- Verify installation:
```powershell
git --version
```

### 3. Install Visual C++ Build Tools (for better-sqlite3)
**Option A: Install full Visual Studio** (Recommended)
- Download Visual Studio Community from: https://visualstudio.microsoft.com/downloads/
- During installation, select "Desktop development with C++"

**Option B: Install Build Tools only**
- Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Select "C++ build tools" workload

---

## Installation Steps

### 1. Clone Repository
```powershell
git clone https://github.com/DBAYF/tcgfetch.git
cd tcgfetch
```

### 2. Install Dependencies
```powershell
npm install
```

**Note:** This may take 5-10 minutes as it compiles native modules (better-sqlite3)

### 3. Build Project
```powershell
npm run build
```

---

## Running the Downloader

### Basic Usage
```powershell
npm start
```

### With High Concurrency
```powershell
$env:CONCURRENCY=30
npm start
```

### Download Specific Game
```powershell
npm run download:yugioh
npm run download:mtg
npm run download:pokemon
npm run download:fab
```

---

## Troubleshooting

### Error: "node-gyp" build failed

**Solution 1:** Install Python
```powershell
# Install Python 3.x from https://www.python.org/
# Make sure to check "Add Python to PATH" during installation

# Verify Python is installed
python --version
```

**Solution 2:** Install Windows Build Tools
```powershell
npm install --global windows-build-tools
```

**Solution 3:** Use pre-built binaries
```powershell
npm install better-sqlite3 --build-from-source=false
```

### Error: "Cannot find module"

**Solution:**
```powershell
# Clean and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
npm run build
```

### Error: "Permission denied"

**Solution:** Run PowerShell as Administrator
- Right-click PowerShell
- Select "Run as Administrator"
- Navigate to project folder
- Run commands again

### Database locked errors

**Solution:** Close any SQLite browsers or editors
```powershell
# If database is locked, delete and restart
Remove-Item tcg-data\download-tracker.db
npm start
```

---

## Windows-Specific Notes

### Path Separators
- The code automatically handles Windows backslashes (`\`) vs Unix forward slashes (`/`)
- No configuration needed

### Line Endings
- Git automatically converts LF to CRLF on Windows
- No action needed

### File Permissions
- Windows doesn't have Unix-style file permissions
- All files are accessible by default

### Long Paths
If you encounter "path too long" errors:

1. Enable long path support (Windows 10 1607+):
```powershell
# Run as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

2. Or install to shorter path:
```powershell
cd C:\
git clone https://github.com/DBAYF/tcgfetch.git tcg
cd tcg
```

### Disk Space
- Ensure you have at least **60GB free space** on C: drive
- Or change data directory in code to different drive

---

## Environment Variables

Create a `.env` file in project root:

```env
# Optional: Pokémon TCG API Key
POKEMON_TCG_API_KEY=your_key_here

# Download Configuration
CONCURRENCY=20
DOWNLOAD_IMAGES=true
```

---

## Performance Tips for Windows

### 1. Disable Windows Defender Real-Time Scanning (Temporarily)
- Can speed up npm install and file operations
- Remember to re-enable after

### 2. Use SSD for Storage
- Much faster than HDD for thousands of small files
- Move `tcg-data` folder to SSD if needed

### 3. Close Unnecessary Programs
- Free up RAM and CPU
- Especially browsers and video players

### 4. Adjust Concurrency
```powershell
# Lower concurrency for slower systems
$env:CONCURRENCY=10
npm start

# Higher concurrency for powerful systems
$env:CONCURRENCY=50
npm start
```

---

## Monitoring Progress

### View Real-Time Status
The downloader shows a live dashboard in the console window

### Check Database
```powershell
# Install sqlite3 command-line tool
choco install sqlite

# View sessions
sqlite3 tcg-data\download-tracker.db "SELECT * FROM download_sessions ORDER BY started_at DESC LIMIT 5"
```

### View Downloaded Files
```powershell
# Count downloaded cards
(Get-ChildItem -Path tcg-data -Filter "*.json" -Recurse).Count

# Count downloaded images
(Get-ChildItem -Path tcg-data -Filter "*.jpg" -Recurse).Count

# Check disk usage
Get-ChildItem tcg-data -Recurse | Measure-Object -Property Length -Sum
```

---

## Scheduled Downloads (Windows Task Scheduler)

### Create Batch File
Create `run-download.bat`:
```batch
@echo off
cd C:\path\to\tcgfetch
call npm start
```

### Schedule with Task Scheduler
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at 2 AM)
4. Action: Start a program
5. Program: `C:\path\to\tcgfetch\run-download.bat`

---

## Common Windows Commands

```powershell
# View logs
Get-Content logs\download-*.log -Tail 50

# Follow logs in real-time
Get-Content logs\download-*.log -Wait

# Check if process is running
Get-Process node

# Kill stuck process
Stop-Process -Name node -Force

# Free disk space
Get-PSDrive C

# Network test
Test-NetConnection api.scryfall.com -Port 443
Test-NetConnection api.pokemontcg.io -Port 443
```

---

## Firewall Configuration

If downloads fail, allow Node.js through Windows Firewall:

1. Open Windows Defender Firewall
2. Click "Allow an app or feature"
3. Click "Change settings"
4. Find "Node.js" or click "Allow another app"
5. Add Node.js executable
6. Check both Private and Public networks

---

## Antivirus Exclusions

Add these folders to antivirus exclusions for better performance:

- `C:\path\to\tcgfetch\node_modules`
- `C:\path\to\tcgfetch\tcg-data`
- `C:\path\to\tcgfetch\dist`

---

## Getting Help

### View Logs
```powershell
cd logs
notepad download-*.log
```

### Check System Resources
```powershell
# Task Manager
taskmgr

# Performance Monitor
perfmon
```

### Test Installation
```powershell
npm test
node --version
npm --version
git --version
```

---

## Uninstallation

```powershell
# Remove project
cd ..
Remove-Item -Recurse -Force tcgfetch

# Uninstall Node.js (optional)
# Use Windows "Add or Remove Programs"
```

---

## Success Checklist

- [ ] Node.js installed (v20+)
- [ ] Git installed
- [ ] Visual C++ Build Tools installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install` successful)
- [ ] Project built (`npm run build` successful)
- [ ] Downloader runs (`npm start` shows dashboard)
- [ ] At least 60GB free disk space
- [ ] Stable internet connection

---

## Support

**Issues?**
- Check logs in `logs/` folder
- View database errors in SQLite
- Open issue on GitHub: https://github.com/DBAYF/tcgfetch/issues

**Windows-Specific Issues?**
- Ensure all prerequisites are installed
- Run PowerShell as Administrator
- Check Windows Defender/Antivirus settings
- Verify firewall allows Node.js

---

**Your production TCG downloader is ready for Windows! 🎉**

