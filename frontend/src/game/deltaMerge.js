// Los mensajes livianos del servidor (DeltaEncoder) omiten lo que no cambio: las
// partes nombradas en `unchanged` y, de cada jugador, lo marcado con `staticOmitted`.
// Aqui se completan con lo que ya se tenia.
export function mergeDelta(body, previous) {
  const merged = { ...body };
  (body.unchanged ?? []).forEach((key) => {
    merged[key] = previous[key];
  });
  if (Array.isArray(body.players)) {
    const before = new Map((previous.players ?? []).map((p) => [p.playerId, p]));
    merged.players = body.players.map((player) => {
      if (!player.staticOmitted) return player;
      const old = before.get(player.playerId);
      return {
        ...player,
        inventory: old?.inventory ?? [],
        missions: old?.missions ?? [],
        name: old?.name ?? null,
        costume: old?.costume ?? null,
        perks: old?.perks ?? [],
        perkOffer: old?.perkOffer ?? [],
      };
    });
  }
  return merged;
}
