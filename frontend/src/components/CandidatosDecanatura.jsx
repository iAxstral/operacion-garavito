// Los dos candidatos (ficticios) de la intro de Navidad, en pixel art con SVG: cada
// rectangulo es un "pixel" de una cuadricula de 32x48. No representan a nadie real.

function Px({ x, y, w = 1, h = 1, c }) {
  return <rect x={x} y={y} width={w} height={h} fill={c} />;
}

/** El Candidato Nochebueno: caricatura de Papa Noel con barba blanca y abrigo rojo. */
export function CandidatoNochebueno({ brazoArriba = false }) {
  const rojo = '#b3201a';
  const rojoOscuro = '#7a1410';
  const blanco = '#efe9dc';
  const piel = '#e9b48a';
  return (
    <svg viewBox="0 0 32 48" shapeRendering="crispEdges" className="xd-sprite" aria-hidden="true">
      {/* Gorro */}
      <Px x={11} y={1} w={9} h={3} c={rojo} />
      <Px x={19} y={2} w={4} h={2} c={rojo} />
      <Px x={22} y={1} w={3} h={3} c={blanco} />
      <Px x={9} y={4} w={14} h={2} c={blanco} />
      {/* Cara y barba */}
      <Px x={10} y={6} w={12} h={6} c={piel} />
      <Px x={12} y={8} w={2} h={1} c="#1a0d08" />
      <Px x={18} y={8} w={2} h={1} c="#1a0d08" />
      <Px x={11} y={10} w={2} h={1} c="#d86a5a" />
      <Px x={19} y={10} w={2} h={1} c="#d86a5a" />
      <Px x={9} y={11} w={14} h={6} c={blanco} />
      <Px x={11} y={17} w={10} h={2} c={blanco} />
      <Px x={14} y={12} w={4} h={1} c="#7a1410" />
      {/* Abrigo */}
      <Px x={8} y={17} w={16} h={14} c={rojo} />
      <Px x={15} y={19} w={2} h={12} c={blanco} />
      <Px x={8} y={26} w={16} h={2} c="#16110e" />
      <Px x={14} y={26} w={4} h={2} c="#e8c34a" />
      <Px x={8} y={31} w={16} h={2} c={blanco} />
      {/* Brazos: el derecho sube al ganar */}
      <Px x={4} y={18} w={4} h={10} c={rojoOscuro} />
      <Px x={4} y={28} w={4} h={3} c="#16110e" />
      {brazoArriba ? (
        <>
          <Px x={24} y={8} w={4} h={11} c={rojoOscuro} />
          <Px x={24} y={5} w={4} h={3} c="#16110e" />
        </>
      ) : (
        <>
          <Px x={24} y={18} w={4} h={10} c={rojoOscuro} />
          <Px x={24} y={28} w={4} h={3} c="#16110e" />
        </>
      )}
      {/* Piernas y botas */}
      <Px x={10} y={33} w={5} h={10} c="#2a1c16" />
      <Px x={17} y={33} w={5} h={10} c="#2a1c16" />
      <Px x={9} y={43} w={7} h={4} c="#0d0907" />
      <Px x={16} y={43} w={7} h={4} c="#0d0907" />
    </svg>
  );
}

/** La Candidata Escarcha: bruja del hielo con mono azul helado y abrigo verde. */
export function CandidataEscarcha() {
  const verde = '#1f5a3a';
  const verdeOscuro = '#123d27';
  const hielo = '#cfe6f2';
  const piel = '#d7e4ea';
  return (
    <svg viewBox="0 0 32 48" shapeRendering="crispEdges" className="xd-sprite" aria-hidden="true">
      {/* Mono de pelo helado con un carambano de gancho */}
      <Px x={12} y={0} w={8} h={4} c={hielo} />
      <Px x={20} y={1} w={2} h={6} c="#9fd3f0" />
      <Px x={10} y={4} w={12} h={3} c={hielo} />
      {/* Cara */}
      <Px x={10} y={7} w={12} h={9} c={piel} />
      <Px x={9} y={7} w={1} h={7} c={hielo} />
      <Px x={22} y={7} w={1} h={7} c={hielo} />
      <Px x={12} y={10} w={2} h={1} c="#1b2a35" />
      <Px x={18} y={10} w={2} h={1} c="#1b2a35" />
      <Px x={12} y={9} w={3} h={1} c="#5b6f7c" />
      <Px x={17} y={9} w={3} h={1} c="#5b6f7c" />
      <Px x={14} y={13} w={4} h={1} c="#3a4a8a" />
      {/* Bufanda a rayas */}
      <Px x={9} y={16} w={14} h={3} c="#e9e3d6" />
      <Px x={11} y={16} w={2} h={3} c="#a3161a" />
      <Px x={16} y={16} w={2} h={3} c="#a3161a" />
      <Px x={19} y={19} w={3} h={6} c="#e9e3d6" />
      <Px x={19} y={21} w={3} h={2} c="#a3161a" />
      {/* Abrigo largo */}
      <Px x={8} y={19} w={16} h={18} c={verde} />
      <Px x={15} y={21} w={2} h={2} c="#e8c34a" />
      <Px x={15} y={26} w={2} h={2} c="#e8c34a" />
      <Px x={15} y={31} w={2} h={2} c="#e8c34a" />
      <Px x={4} y={20} w={4} h={11} c={verdeOscuro} />
      <Px x={24} y={20} w={4} h={11} c={verdeOscuro} />
      <Px x={4} y={31} w={4} h={2} c={piel} />
      <Px x={24} y={31} w={4} h={2} c={piel} />
      {/* Piernas y botas */}
      <Px x={11} y={37} w={4} h={6} c="#4c5560" />
      <Px x={17} y={37} w={4} h={6} c="#4c5560" />
      <Px x={10} y={43} w={6} h={4} c="#1c1416" />
      <Px x={16} y={43} w={6} h={4} c="#1c1416" />
    </svg>
  );
}

/** La placa dorada de la Decanatura que ambos quieren. */
export function PlacaDecanatura() {
  return (
    <svg viewBox="0 0 60 28" className="xd-placa-svg" aria-hidden="true">
      <rect x="1" y="1" width="58" height="26" rx="3" fill="#b8962a" stroke="#5c4510" strokeWidth="2" />
      <rect x="5" y="5" width="50" height="18" rx="2" fill="#e2c35a" />
      <text x="30" y="17.5" textAnchor="middle" fontSize="8.5" fontWeight="bold" fontFamily="Georgia, serif" fill="#3b2a06">
        DECANATURA
      </text>
    </svg>
  );
}
