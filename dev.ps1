# Levanta backend (Spring Boot, perfil dev) y frontend (Vite) en ventanas de PowerShell separadas.

$backendDir  = Join-Path $PSScriptRoot 'backend'
$frontendDir = Join-Path $PSScriptRoot 'frontend'

foreach ($dir in @($backendDir, $frontendDir)) {
    if (-not (Test-Path $dir)) {
        Write-Error "No se encontro el directorio: $dir"
        exit 1
    }
}

$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }

Write-Host "Levantando backend (perfil dev) en una nueva ventana..." -ForegroundColor Cyan
Start-Process $shell -WorkingDirectory $backendDir -ArgumentList @(
    '-NoExit', '-Command',
    '$Host.UI.RawUI.WindowTitle = ''Backend''; .\mvnw.cmd spring-boot:run ''-Dspring-boot.run.profiles=dev'''
)

Write-Host "Levantando frontend (npm run dev) en una nueva ventana..." -ForegroundColor Cyan
Start-Process $shell -WorkingDirectory $frontendDir -ArgumentList @(
    '-NoExit', '-Command',
    '$Host.UI.RawUI.WindowTitle = ''Frontend''; npm run dev'
)

Write-Host "Ambas ventanas se abrieron: backend y frontend estan arrancando." -ForegroundColor Green
Write-Host "Cierra cada ventana (o Ctrl+C) para detener el servicio correspondiente."
