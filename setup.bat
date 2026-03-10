@echo off
echo ====================================
echo Student Wellness Dashboard Setup
echo ====================================
echo.

echo [1/4] Installing Backend Dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Backend installation failed!
    pause
    exit /b 1
)
echo Backend dependencies installed successfully!
echo.

echo [2/4] Installing Frontend Dependencies...
cd ..\frontend-student
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend installation failed!
    pause
    exit /b 1
)
echo Frontend dependencies installed successfully!
echo.

echo [3/4] Checking MongoDB...
sc query MongoDB >nul 2>&1
if %errorlevel% equ 0 (
    echo MongoDB service found!
    net start MongoDB >nul 2>&1
    echo MongoDB is running.
) else (
    echo.
    echo WARNING: MongoDB service not found!
    echo Please install MongoDB from: https://www.mongodb.com/try/download/community
    echo Or use MongoDB Atlas cloud service.
    echo.
)

echo [4/4] Setup Complete!
echo.
echo ====================================
echo Next Steps:
echo ====================================
echo 1. Make sure MongoDB is running
echo 2. Open TWO terminal windows
echo 3. In terminal 1, run: cd backend ^&^& npm start
echo 4. In terminal 2, run: cd frontend-student ^&^& npm start
echo 5. Open browser to http://localhost:3000
echo ====================================
echo.
pause
