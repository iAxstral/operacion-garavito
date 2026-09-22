import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onNearMissionChange,
  onStateChange,
  getMyRole,
  requestMissionStart,
  requestMissionCancel,
  requestMissionComplete,
  setInputLocked,
} from '../game/gameSync';

const SUCCESS_CLOSE_DELAY_MS = 1100;

// `role` es el rol dueño de este minijuego (p.ej. 'SALUD'), no un missionId fijo: cada
// rol ahora tiene 3 salas/instancias posibles (mission-salud, mission-salud-f1,
// mission-salud-f2), y el jugador puede acercarse a cualquiera de las 3.
export default function useMissionFlow(role, onStarted) {
  const [nearMission, setNearMission] = useState(null);
  const [phase, setPhase] = useState('closed');
  const [lastEvent, setLastEvent] = useState(null);

  const activeMissionRef = useRef(null);
  const finishedRef = useRef(false);
  const onStartedRef = useRef(onStarted);
  useEffect(() => {
    onStartedRef.current = onStarted;
  });

  useEffect(
    () => onNearMissionChange((mission) => setNearMission(mission?.role === role ? mission : null)),
    [role],
  );

  useEffect(() => onStateChange((state) => setLastEvent(state.lastEvent)), []);

  const close = useCallback(() => {
    setInputLocked(false);
    setPhase('closed');
  }, []);

  useEffect(() => {
    const event = lastEvent;
    const activeId = activeMissionRef.current?.missionId;
    if (!event || event.playerId !== getMyRole() || !activeId || event.itemId !== activeId) return;

    if (event.type === 'MISSION_STARTED') {
      finishedRef.current = false;
      onStartedRef.current?.();
      setPhase('active');
      setInputLocked(true);
    } else if (event.type === 'MISSION_REJECTED') {
      close();
    }
  }, [lastEvent, close]);

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
