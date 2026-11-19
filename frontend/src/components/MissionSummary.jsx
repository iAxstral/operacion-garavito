import { missionTypesForRole } from '../game/missionCatalog';
import { Glyph } from './Icon';

/** Los minijuegos de un rol con su icono dibujado (version visual de missionSummary). */
export default function MissionSummary({ role }) {
  return missionTypesForRole(role).map((type, i) => (
    <span key={type.type} className="mission-summary-item">
      {i > 0 && ' · '}
      <Glyph value={type.icon} /> {type.name}
    </span>
  ));
}
