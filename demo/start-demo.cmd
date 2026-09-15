@echo off
rem ThinkOne demo lokaalserveris + avab brauseri
start "" http://localhost:8471/
node "%~dp0serve.js"
