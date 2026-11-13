# Corre k6 contra el despliegue en AWS y manda sus metricas al Prometheus de la nube,
# para verlas en https://www.operaciongaravito.me/grafana/ (tablero "Prueba de carga (k6)").
#
#   .\k6\nube.ps1                    # perfil estres (hasta 200 jugadores)
#   .\k6\nube.ps1 -Perfil humo       # 4 jugadores, para probar que todo responde
#   .\k6\nube.ps1 -Reporte           # ademas deja docs/k6/reporte-nube-<perfil>.html
#   .\k6\nube.ps1 -SoloClaves        # solo muestra las claves de Grafana y Prometheus
#
# Requiere k6 (winget install k6) y la sesion de AWS iniciada (aws login).
param(
    [ValidateSet('humo', 'carga', 'estres')]
    [string]$Perfil = 'estres',
    [switch]$Reporte,
    [switch]$SoloClaves
)
$ErrorActionPreference = 'Stop'
$Region = 'us-east-2'
$Url = 'https://www.operaciongaravito.me'

# Las claves se generan en la maquina al crearla; se leen por SSM.
$Id = aws cloudformation describe-stacks --region $Region --stack-name OperacionGaravito `
    --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text
if (-not $Id) { throw 'No se encontro la maquina. Corre "aws login" y vuelve a intentar.' }
$Cid = aws ssm send-command --region $Region --instance-ids $Id --document-name AWS-RunShellScript `
    --parameters 'commands=cat /opt/garavito/monitoring.env' --query Command.CommandId --output text
Start-Sleep -Seconds 4
$Salida = aws ssm get-command-invocation --region $Region --command-id $Cid --instance-id $Id `
    --query StandardOutputContent --output text
$Claves = @{}
foreach ($linea in ($Salida -split "`n")) {
    if ($linea -match '^(\w+)=(.+)$') { $Claves[$Matches[1]] = $Matches[2].Trim() }
}
if (-not $Claves['PROMETHEUS_PASSWORD']) { throw "No se pudieron leer las claves de la maquina: $Salida" }

if ($SoloClaves) {
    Write-Host "Grafana    $Url/grafana/      usuario $($Claves['GRAFANA_USER'])  clave $($Claves['GRAFANA_PASSWORD'])"
    Write-Host "Prometheus $Url/prometheus/   usuario $($Claves['PROMETHEUS_USER'])  clave $($Claves['PROMETHEUS_PASSWORD'])"
    return
}

$TestId = "$Perfil-nube-$(Get-Date -Format 'MMdd-HHmm')"
$env:K6_PROMETHEUS_RW_SERVER_URL = "$Url/prometheus/api/v1/write"
$env:K6_PROMETHEUS_RW_USERNAME = $Claves['PROMETHEUS_USER']
$env:K6_PROMETHEUS_RW_PASSWORD = $Claves['PROMETHEUS_PASSWORD']
$env:K6_PROMETHEUS_RW_TREND_STATS = 'p(50),p(95),p(99),avg,max'
if ($Reporte) {
    $env:K6_WEB_DASHBOARD = 'true'
    $env:K6_WEB_DASHBOARD_EXPORT = "docs/k6/reporte-nube-$Perfil.html"
}

# k6 escribe avisos en stderr; con 'Stop', PowerShell 5.1 los toma como error y corta la prueba.
$ErrorActionPreference = 'Continue'
Write-Host "Corrida $TestId contra $Url. En Grafana: $Url/grafana/ -> Prueba de carga (k6) -> Corrida $TestId"
k6 run -o experimental-prometheus-rw --tag testid=$TestId -e BASE_URL=$Url -e PERFIL=$Perfil k6/partidas.js
exit $LASTEXITCODE
