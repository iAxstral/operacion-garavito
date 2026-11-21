#!/usr/bin/env bash
# Corre las pruebas de carga, estres y pico contra un backend local recien levantado,
# registrando las metricas del servidor antes, durante y despues de cada una.
#
#   cd backend && ./mvnw -B package -DskipTests && cd ..
#   bash k6/correr_pruebas.sh               # las tres
#   bash k6/correr_pruebas.sh pico          # solo una
#
# Deja en docs/k6/resultados/: <perfil>.json (resumen con TPS/TPM), <perfil>.txt (salida
# de k6) y <perfil>-servidor.csv (metricas del backend); y docs/k6/reporte-<perfil>.html
# (graficas de k6). Despues: python k6/graficar.py
set -euo pipefail
cd "$(dirname "$0")/.."

JAR=$(ls backend/target/operacion-garavito-*.jar | head -1)
OUT=docs/k6/resultados
URL=http://localhost:8080
PERFILES=${*:-carga estres pico}
mkdir -p "$OUT"

for perfil in $PERFILES; do
  echo "=== $perfil: levantando backend"
  java -Xmx1g -jar "$JAR" --spring.profiles.active=dev,carga > "$OUT/$perfil-backend.log" 2>&1 &
  backend=$!
  until curl -s -o /dev/null "$URL/api/ping"; do sleep 2; done

  python k6/registrar_metricas.py --url "$URL" --salida "$OUT/$perfil-servidor.csv" &
  registro=$!
  sleep 20   # linea base: el servidor sin carga

  echo "=== $perfil: k6"
  K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="docs/k6/reporte-$perfil.html" \
    k6 run -e BASE_URL="$URL" -e PERFIL="$perfil" k6/partidas.js 2>&1 | tee "$OUT/$perfil.txt" || true

  sleep 30   # recuperacion: que pasa cuando se va la carga
  kill "$registro" "$backend" 2>/dev/null || true
  wait "$backend" 2>/dev/null || true
  rm -f "$OUT/$perfil-backend.log"
done
echo "=== listo"
