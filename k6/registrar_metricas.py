"""Registra las metricas del backend mientras corre una prueba de k6.

Lee /actuator/prometheus (el mismo endpoint que usa Prometheus) cada INTERVALO
segundos y guarda una fila por lectura en un CSV. Sirve para correlacionar k6 con el
servidor sin levantar Prometheus y Grafana (por ejemplo, en un portatil sin Docker).
Con Prometheus y Grafana arriba se ve lo mismo en el tablero "Operación Garavito".

    python k6/registrar_metricas.py --url http://localhost:8080 --salida docs/k6/resultados/pico-servidor.csv

Se detiene con Ctrl+C (o matando el proceso); cada fila se escribe al momento.
"""
import argparse
import csv
import re
import time
import urllib.request

LINEA = re.compile(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([-+0-9.eEInfNa]+)')


def leer(url):
    with urllib.request.urlopen(url + '/actuator/prometheus', timeout=5) as respuesta:
        texto = respuesta.read().decode('utf-8')
    metricas = {}
    for linea in texto.splitlines():
        m = LINEA.match(linea)
        if m:
            metricas.setdefault(m.group(1), []).append((m.group(2) or '', float(m.group(3))))
    return metricas


def suma(metricas, nombre, filtro=''):
    return sum(v for etiquetas, v in metricas.get(nombre, []) if filtro in etiquetas)


def maximo(metricas, nombre, filtro=''):
    valores = [v for etiquetas, v in metricas.get(nombre, []) if filtro in etiquetas]
    return max(valores) if valores else 0.0


COLUMNAS = ['t', 'salas', 'jugadores', 'zombis', 'tick_p99_ms', 'mensajes_total',
            'rechazos_total', 'cpu_proceso', 'cpu_sistema', 'heap_mb', 'hilos', 'arriba']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://localhost:8080')
    parser.add_argument('--salida', required=True)
    parser.add_argument('--intervalo', type=float, default=2.0)
    args = parser.parse_args()

    with open(args.salida, 'w', newline='', encoding='utf-8') as archivo:
        escritor = csv.writer(archivo)
        escritor.writerow(COLUMNAS)
        while True:
            inicio = time.time()
            try:
                m = leer(args.url)
                fila = [round(inicio, 1),
                        suma(m, 'garavito_rooms'), suma(m, 'garavito_players'), suma(m, 'garavito_zombies'),
                        round(1000 * maximo(m, 'garavito_tick_seconds', 'quantile="0.99"'), 2),
                        suma(m, 'garavito_messages_total'), suma(m, 'garavito_rejected_total'),
                        round(maximo(m, 'process_cpu_usage'), 3), round(maximo(m, 'system_cpu_usage'), 3),
                        round(suma(m, 'jvm_memory_used_bytes', 'area="heap"') / 2 ** 20, 1),
                        suma(m, 'jvm_threads_live_threads'), 1]
            except OSError:
                # El backend no respondio: queda registrado como caida.
                fila = [round(inicio, 1)] + [''] * (len(COLUMNAS) - 2) + [0]
            escritor.writerow(fila)
            archivo.flush()
            time.sleep(max(0.0, args.intervalo - (time.time() - inicio)))


if __name__ == '__main__':
    main()
