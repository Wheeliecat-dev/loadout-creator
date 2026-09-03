@echo off
cd /d "%~dp0"
start "" http://localhost:5544
node server.js
