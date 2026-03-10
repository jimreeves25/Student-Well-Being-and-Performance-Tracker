@echo off
echo ====================================
echo Starting Backend Server...
echo ====================================
cd backend
start cmd /k "npm start"
echo Backend server starting in new window...
timeout /t 3 /nobreak >nul

echo.
echo ====================================
echo Starting Frontend Server...
echo ====================================
cd ..\frontend-student
start cmd /k "npm start"
echo Frontend server starting in new window...

echo.
echo ====================================
echo Servers are starting!
echo ====================================
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this window...
pause >nul
