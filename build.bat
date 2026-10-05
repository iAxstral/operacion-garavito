@echo off
setlocal
set ROOT=%~dp0

echo ==^> Backend (Maven)
cd /d "%ROOT%backend" || exit /b 1
call mvnw.cmd -B clean package || exit /b 1

echo ==^> Frontend (Vite)
cd /d "%ROOT%frontend" || exit /b 1
call npm ci || exit /b 1
call npm run build || exit /b 1

set LAN_IP=tu-ip
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set LAN_IP=%%a
set LAN_IP=%LAN_IP: =%
echo ==^> Iniciando backend (puerto 8080) y frontend (puerto 4173)
echo     Tu:      http://localhost:4173
echo     Equipo:  http://%LAN_IP%:4173  (misma red Wi-Fi, tambien desde iPhone/Safari)
start "Backend" cmd /k java -Dspring.profiles.active=dev -jar "%ROOT%backend\target\operacion-garavito-0.0.1-SNAPSHOT.jar"
start "Frontend" cmd /k npm run preview -- --host --port 4173 --strictPort
start "" http://localhost:4173
echo Cierra las ventanas Backend y Frontend para detener el juego.
pause
endlocal
