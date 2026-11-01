/** Regalo de Navidad entreabierto: algo mira desde adentro. Solo decoracion. */
export default function RegaloMaldito({ conNieve = false }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <rect x="6" y="20" width="36" height="24" rx="2" fill="#5e0b0b" />
      <rect x="4" y="14" width="40" height="8" rx="2" fill="#7d1010" />
      <rect x="21" y="14" width="6" height="30" fill="#c9a227" />
      <path d="M24 14c-3-8-12-9-12-3 0 4 7 3 12 3zM24 14c3-8 12-9 12-3 0 4-7 3-12 3z" fill="none" stroke="#c9a227" strokeWidth="2.5" />
      <circle className="regalo-ojo" cx="15" cy="30" r="2" fill="#ff3b30" />
      <circle className="regalo-ojo" cx="33" cy="30" r="2" fill="#ff3b30" />
      <path d="M8 40c6-3 10 2 16-1s10 2 16-1" fill="none" stroke="#3a0505" strokeWidth="2" />
      {conNieve && (
        <>
          {/* Nieve acumulada encima y alrededor de la base. */}
          <path d="M3 15c4-3 9 1 14-1s10 2 15 0 9-2 13 1v2H3z" fill="#e8f1f7" />
          <path d="M-6 48c4-7 12-9 18-6s12-4 20-2 14 1 22 8z" fill="#dce8f1" />
        </>
      )}
    </svg>
  );
}
