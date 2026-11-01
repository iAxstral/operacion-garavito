import HalloweenCreatures from './HalloweenCreatures';
import NavidadCreatures from './NavidadCreatures';
import useTemporada from './useTemporada';

/**
 * Las criaturas de la temporada que se ve ahora. Recibe las cantidades de Halloween
 * (murcielagos y aranas) y las traduce a Navidad (nieve y esferas rotas).
 */
export default function TemporadaCreatures({ bats, spiders }) {
  const temporada = useTemporada();
  if (temporada.id === 'HALLOWEEN') return <HalloweenCreatures bats={bats} spiders={spiders} />;
  return <NavidadCreatures ornaments={spiders} snow={bats === undefined ? undefined : Math.max(12, bats * 6)} />;
}
