Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    云栈 - Desktop Build Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    pause
    exit 1
}

# Set mirror for Electron download (China mirror, no VPN needed)
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm config set registry https://registry.npmmirror.com 2>$null

Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "[2/4] Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "[3/4] Preparing Electron..." -ForegroundColor Yellow
npx electron --version 2>$null

Write-Host "[4/4] Packaging desktop app..." -ForegroundColor Yellow
npx electron-builder
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Packaging failed" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "    BUILD SUCCESS!" -ForegroundColor Green
Write-Host "    Installer located in: release/" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
pause
