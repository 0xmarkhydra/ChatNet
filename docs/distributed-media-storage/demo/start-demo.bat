@echo off
cd /d "%~dp0"
node --version
echo Server + 6 node agent. Mo http://localhost:5600 (dong cua so nay de dung tat ca)
node --no-warnings --experimental-strip-types src/server.ts
pause
