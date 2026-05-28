@echo off
title Guinea Pig Trench — Test Server
echo.
echo ===================================================
echo   GUINEA PIG TRENCH — LOCAL TEST SERVER
echo ===================================================
echo.
echo Starting server on http://localhost:8000
echo.
python server.py
if errorlevel 1 (
    echo.
    echo Python not found! Trying py...
    py server.py
)
pause
