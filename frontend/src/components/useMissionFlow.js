import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onNearMissionChange,
  onGameEvent,
  getMyRole,
  requestMissionStart,
  requestMissionCancel,
  requestMissionComplete,
  setInputLocked,
} from '../game/gameSync';

const SUCCESS_CLOSE_DELAY_MS = 1100;

// `type` es el minijuego (p.ej. 'CABLES'): cada Kinder el servidor reparte 3 misiones por
// jugador en salas al azar, y cada componente de minijuego se abre solo cuando el
// jugador esta junto a una mision de su tipo.
export default function useMissionFlow(type, onStarted) {
  const [nearMission, setNearMission] = useState(null);
  const [phase, setPhase] = useState('closed');

  const activeMissionRef = useRef(null);
  const finishedRef = useRef(false);
  const onStartedRef = useRef(onStarted);
  useEffect(() => {
    onStartedRef.current = onStarted;
  });

  useEffect(
    () => onNearMissionChange((mission) => setNearMission(mission?.type === type ? mission : null)),
    [type],
  );


  const close = useCallback(() => {
    setInputLocked(false);
    setPhase('closed');
  }, []);

  useEffect(() => onGameEvent((event) => {
    const activeId = activeMissionRef.current?.missionId;
    if (event.playerId !== getMyRole() || !activeId || event.itemId !== activeId) return;

    if (event.type === 'MISSION_STARTED') {
      finishedRef.current = false;
      onStartedRef.current?.();
      setPhase('active');
      setInputLocked(true);
    } else if (event.type === 'MISSION_REJECTED') {
      close();
    }
  }), [close]);

  const cancel = useCallback(() => {
    requestMissionCancel(activeMissionRef.current?.missionId ?? nearMission?.missionId);
    close();
  }, [nearMission, close]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.key === 'e' || event.key === 'E') && phase === 'closed' && nearMission) {
        event.preventDefault();
        activeMissionRef.current = nearMission;
        requestMissionStart(nearMission.missionId);
      } else if (event.key === 'Escape' && phase === 'active') {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, nearMission, cancel]);

  const finishSuccess = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('success');
    const mission = activeMissionRef.current;
    setTimeout(() => {
      if (mission) requestMissionComplete(mission.missionId, mission.x, mission.y);
      close();
    }, SUCCESS_CLOSE_DELAY_MS);
  }, [close]);

  return { phase, nearMission, finishSuccess, cancel };
}
