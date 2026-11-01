import { useSyncExternalStore } from 'react';
import { TEMPORADAS, getTemporada, onTemporadaChange } from '../game/temporada';

/** Datos de la temporada que se ve ahora; el componente se redibuja si cambia. */
export default function useTemporada() {
  const id = useSyncExternalStore(onTemporadaChange, getTemporada, getTemporada);
  return TEMPORADAS[id];
}
