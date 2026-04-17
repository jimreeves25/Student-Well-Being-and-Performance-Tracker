#!/bin/bash
# Quick startup script for full-stack testing

echo "🚀 Starting Student Well Being Tracker for testing..."
echo ""

# Kill any existing processes on ports
echo "Cleaning up ports 3001 and 3000..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "✓ Port 3001 free"
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "✓ Port 3000 free"

sleep 2

# Start backend
echo ""
echo "Starting backend on port 3001..."
cd backend
npm start &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 3

# Check backend health
echo ""
echo "Checking backend health..."
curl -s http://localhost:3001 | grep -q "Student Wellness Backend API" && echo "✅ Backend is running" || echo "❌ Backend failed to start"

# Start frontend
echo ""
echo "Starting frontend on port 3000..."
cd ../frontend-student
npm start &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

sleep 5

echo ""
echo "=========================================="
echo "✅ Both services starting up"
echo "=========================================="
echo ""
echo "Frontend:   http://localhost:3000"
echo "Backend:    http://localhost:3001"
echo ""
echo "Open http://localhost:3000 in your browser"
echo "Press Ctrl+C to stop both services"
echo ""
echo "Test account:"
echo "  Email: test@example.com"
echo "  Password: 123456"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
