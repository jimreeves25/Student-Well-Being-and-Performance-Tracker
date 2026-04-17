# Windows PowerShell Startup Script for Testing
# Run this in PowerShell to start both backend and frontend

Write-Host "🚀 Starting Student Well Being Tracker for Testing..." -ForegroundColor Green
Write-Host ""

# Kill processes on port 3001
Write-Host "Stopping any existing backend process..."
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | 
  Where-Object { $_.LocalPort -eq 3001 } | 
  Select-Object -ExpandProperty OwningProcess -Unique | 
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# Kill processes on port 3000  
Write-Host "Stopping any existing frontend process..."
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | 
  Where-Object { $_.LocalPort -eq 3000 } | 
  Select-Object -ExpandProperty OwningProcess -Unique | 
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Starting Backend on port 3001..." -ForegroundColor Cyan
Set-Location "backend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k npm start" -WindowStyle Normal -PassThru | Out-Null

Start-Sleep -Seconds 4

Write-Host "Checking backend health..." -ForegroundColor Cyan
$backendHealthy = $false
try {
  $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 2 -ErrorAction Stop
  if ($response.Content -match "Student Wellness") {
    Write-Host "✅ Backend is running" -ForegroundColor Green
    $backendHealthy = $true
  }
} catch {
  Write-Host "⚠️ Backend health check failed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Frontend on port 3000..." -ForegroundColor Cyan
Set-Location "../frontend-student"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k npm start" -WindowStyle Normal -PassThru | Out-Null

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Services Starting Up" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend:    http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Account:" -ForegroundColor Yellow
Write-Host "  Email:    test@example.com" -ForegroundColor White
Write-Host "  Password: 123456" -ForegroundColor White
Write-Host ""
Write-Host "Quick Start:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:3000" -ForegroundColor White
Write-Host "2. Login with test account" -ForegroundColor White
Write-Host "3. Open DevTools (F12) - Console + Network tabs" -ForegroundColor White
Watch-Host "4. Test each feature from TESTING-CHECKLIST.md" -ForegroundColor White
Write-Host ""
Write-Host "Both services are now running in separate windows." -ForegroundColor Green
