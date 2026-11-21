"""Graficas de las pruebas de k6 con las metricas del servidor (antes, durante, despues).

Lee docs/k6/resultados/<perfil>-servidor.csv (registrar_metricas.py) y
<perfil>.json (resumen de k6) y deja docs/k6/img/<perfil>-servidor.png y
docs/k6/img/comparativo.png.

    pip install matplotlib
    python k6/graficar.py
"""
import csv
import json
import os

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

RAIZ = os.path.join(os.path.dirname(__file__), '..')
RESULTADOS = os.path.join(RAIZ, 'docs', 'k6', 'resultados')
IMG = os.path.join(RAIZ, 'docs', 'k6', 'img')
PERFILES = ['carga', 'estres', 'pico']
BASE_S = 20  # correr_pruebas.sh espera 20 s antes de lanzar k6


def leer(perfil):
    filas = [f for f in csv.DictReader(open(os.path.join(RESULTADOS, f'{perfil}-servidor.csv'), encoding='utf-8'))
             if f['arriba'] == '1' and f['salas'] != '']
    t0 = float(filas[0]['t'])
    serie = {k: [float(f[k]) for f in filas] for k in filas[0] if k != 'arriba'}
    serie['s'] = [float(f['t']) - t0 for f in filas]
    # Mensajes de estado enviados por segundo (derivada del contador).
    msg = serie['mensajes_total']
    serie['mensajes_s'] = [0.0] + [max(0.0, (msg[i] - msg[i - 1]) / max(0.1, serie['s'][i] - serie['s'][i - 1]))
                                   for i in range(1, len(msg))]
    resumen = json.load(open(os.path.join(RESULTADOS, f'{perfil}.json'), encoding='utf-8'))
    return serie, resumen


def marcar(ax, resumen):
    fin = BASE_S + resumen['duracion_s']
    ax.axvspan(BASE_S, fin, color='#f2c94c', alpha=0.15, lw=0)
    ax.axvline(BASE_S, color='#999', ls='--', lw=0.8)
    ax.axvline(fin, color='#999', ls='--', lw=0.8)
    ax.grid(alpha=0.3)


def por_perfil(perfil):
    s, r = leer(perfil)
    fig, ejes = plt.subplots(4, 1, figsize=(10, 10), sharex=True)
    fig.suptitle(f'Prueba "{perfil}" — servidor antes, durante (franja amarilla) y después de k6\n'
                 f'TPS {r["tps"]} · TPM {r["tpm"]} · movimiento p95 {r["ida_y_vuelta_ms"]["p95"]:.0f} ms · '
                 f'errores HTTP {100 * r["errores_http"]:.1f} %', fontsize=11)
    ejes[0].plot(s['s'], s['jugadores'], color='#2f80ed', label='jugadores')
    ejes[0].plot(s['s'], s['salas'], color='#27ae60', label='salas')
    ejes[0].set_ylabel('cantidad')
    ejes[1].plot(s['s'], s['tick_p99_ms'], color='#eb5757', label='tick p99')
    ejes[1].axhline(66, color='#eb5757', ls=':', lw=1, label='presupuesto 66 ms')
    ejes[1].set_ylabel('ms')
    ejes[2].plot(s['s'], [100 * c for c in s['cpu_sistema']], color='#9b51e0', label='CPU de la máquina')
    ejes[2].plot(s['s'], [100 * c for c in s['cpu_proceso']], color='#f2994a', label='CPU del backend')
    ejes[2].set_ylabel('% CPU')
    ejes[2].set_ylim(0, 105)
    ejes[3].plot(s['s'], s['mensajes_s'], color='#56ccf2', label='estados enviados/s')
    ejes[3].set_ylabel('mensajes/s')
    ejes[3].set_xlabel('segundos desde el arranque del registro')
    for ax in ejes:
        marcar(ax, r)
        ax.legend(loc='upper right', fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(IMG, f'{perfil}-servidor.png'), dpi=110)
    plt.close(fig)


def comparativo():
    datos = {p: leer(p)[1] for p in PERFILES}
    fig, ejes = plt.subplots(1, 3, figsize=(13, 4))
    x = range(len(PERFILES))
    ejes[0].bar(x, [datos[p]['tps'] for p in PERFILES], color='#2f80ed')
    ejes[0].set_title('TPS (movimientos confirmados/s)')
    for nombre, color, desp in [('p50', '#27ae60', -0.25), ('p95', '#f2994a', 0), ('p99', '#eb5757', 0.25)]:
        ejes[1].bar([i + desp for i in x], [datos[p]['ida_y_vuelta_ms'][nombre] for p in PERFILES],
                    width=0.25, color=color, label=nombre)
    ejes[1].axhline(300, color='#333', ls=':', lw=1, label='umbral p95 300 ms')
    ejes[1].set_title('Movimiento confirmado (ms)')
    ejes[1].legend(fontsize=8)
    ejes[2].bar(x, [datos[p]['vus_max'] for p in PERFILES], color='#9b51e0')
    ejes[2].set_title('VUs máximos')
    for ax in ejes:
        ax.set_xticks(list(x))
        ax.set_xticklabels(PERFILES)
        ax.grid(axis='y', alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(IMG, 'comparativo.png'), dpi=110)
    plt.close(fig)


if __name__ == '__main__':
    os.makedirs(IMG, exist_ok=True)
    for perfil in PERFILES:
        por_perfil(perfil)
    comparativo()
    print('Graficas en', os.path.abspath(IMG))
