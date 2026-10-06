# Prueba de carga desde otra máquina

En `ESCALABILIDAD.md` la prueba se corrió con los bots **en la misma máquina** que el
servidor, y con 50 salas los clientes recibían menos estados aunque el servidor estaba
desocupado. Para saber si el límite era del servidor o de la máquina, hay que mandar
la carga desde **otro equipo**. Esta guía deja todo listo para hacerlo en la sala.

## Qué se necesita

- **Máquina A (servidor):** el backend, idealmente con el perfil `dev` o con Docker.
- **Máquina B (generador):** Node 22 o superior y una copia del repositorio (solo se usa
  `frontend/scripts/load-test.mjs` y sus dependencias).
- Las dos en la misma red. En Windows, permitir el puerto del backend en el firewall de A.

## Pasos

1. En **A**, levantar el backend escuchando en la red:

   ```bash
   cd backend
   ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
   ```

   Anotar la IP de A (`ipconfig` en Windows, `ip a` en Linux), p. ej. `192.168.1.20`.

2. (Opcional) En **A**, levantar el monitoreo para ver el servidor en vivo:

   ```bash
   docker compose -f monitoring/docker-compose.yml up -d
   ```

   Grafana en `http://localhost:3000`, tablero *Operación Garavito*.

3. En **B**, instalar dependencias y comprobar que llega:

   ```bash
   cd frontend
   npm ci
   node scripts/load-test.mjs --url ws://192.168.1.20:8080/ws/websocket --rooms 2 --seconds 15
   ```

4. En **B**, la serie que se compara con la de `ESCALABILIDAD.md` (cada corrida tarda
   ~1,5 min; dejar 30 s entre una y otra):

   ```bash
   for salas in 10 25 50 75; do
     node scripts/load-test.mjs --url ws://192.168.1.20:8080/ws/websocket \
       --rooms $salas --players 4 --seconds 75 --out carga-$salas.json
   done
   ```

5. Copiar los `carga-*.json` al repositorio (`docs/carga/`) y llenar la tabla de abajo.

## Cómo leer el resultado

- `mensajesPorSegundoPorCliente` cerca de 8 (o más) y `intervaloEstadoMs.p95` cerca de
  125–200 ms: el servidor aguanta esa cantidad de salas.
- Si con más salas baja el número de mensajes **pero** en Grafana la duración del tick
  sigue en microsegundos y la CPU baja, el límite está en la red o en el generador:
  repetir con dos máquinas generadoras a la vez (cada una con la mitad de las salas).
- `correccionesDeMovimiento` debe quedar en 0 (los bots se mueven dentro de las reglas).
- `tamanoPromedioMensajeKB` ahora debe salir cerca de la mitad que antes gracias a los
  mensajes livianos (`DeltaEncoder`).

## Resultados

| Fecha | Salas | Clientes | Mensajes/s por cliente | Intervalo p50 / p95 (ms) | KB por mensaje | Generador |
|---|---|---|---|---|---|---|
| 2026-10-04 (misma máquina, sin deltas) | 25 | 100 | 9,6 | 102 / 189 | ~3,0 | mismo equipo |
| 2026-10-04 (misma máquina, sin deltas) | 50 | 200 | 2,4 – 4,5 | 95–427 / 620–767 | ~3,0 | mismo equipo |
| *(pendiente)* | 50 | 200 | | | | otra máquina |
