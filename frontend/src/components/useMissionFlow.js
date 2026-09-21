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

export default function useMissionFlow(missionId, onStarted) {
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
    () => onNearMissionChange((mission) => setNearMission(mission?.missionId === missionId ? mission : null)),
    [missionId],
  );

  useEffect(() => onStateChange((state) => setLastEvent(state.lastEvent)), []);

  const close = useCallback(() => {
    setInputLocked(false);
    setPhase('closed');
  }, []);

  useEffect(() => {
    const event = lastEvent;
    if (!event || event.playerId !== getMyRole() || event.itemId !== missionId) return;

    if (event.type === 'MISSION_STARTED') {
      finishedRef.current = false;
      onStartedRef.current?.();
      setPhase('active');
      setInputLocked(true);
    } else if (event.type === 'MISSION_REJECTED') {
      close();
    }
  }, [lastEvent, missionId, close]);

  const cancel = useCallback(() => {
    requestMissionCancel(missionId);
    close();
  }, [missionId, close]);

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
