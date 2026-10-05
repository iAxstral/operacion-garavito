import { useState } from 'react';
import useMissionFlow from './useMissionFlow';

const MISSION_ROLE = 'ECONOMIA';
const QUESTIONS_TARGET = 5;
const OPTION_COUNT = 4;
const WRONG_FLASH_MS = 450;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newQuestion() {
  const terms = Math.random() < 0.4 ? 3 : 2;
  const values = Array.from({ length: terms }, () => randomInt(2, 25));
  const answer = values.reduce((sum, value) => sum + value, 0);

  const options = new Set([answer]);
  while (options.size < OPTION_COUNT) {
    const candidate = answer + randomInt(-9, 9);
    if (candidate > 0) options.add(candidate);
  }
  return { text: `${values.join(' + ')} = ?`, answer, options: [...options].sort(() => Math.random() - 0.5) };
}

export default function MathMission() {
  const [question, setQuestion] = useState(newQuestion);
  const [solved, setSolved] = useState(0);
  const [wrong, setWrong] = useState(null);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_ROLE, () => {
    setQuestion(newQuestion());
    setSolved(0);
    setWrong(null);
  });

  const handleAnswer = (option) => {
    if (wrong !== null) return;
    if (option !== question.answer) {
      setWrong(option);
      setTimeout(() => setWrong(null), WRONG_FLASH_MS);
      return;
    }
    const next = solved + 1;
    setSolved(next);
    if (next >= QUESTIONS_TARGET) {
      finishSuccess();
    } else {
      setQuestion(newQuestion());
    }
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Hacer las cuentas de la cafetería
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Cuentas de la cafetería</h3>
          {phase === 'active' && (
            <>
              <p>Resuelve las sumas para cerrar la caja.</p>
              <div className="math-question">{question.text}</div>
              <div className="math-options">
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`math-option${wrong === option ? ' math-option--wrong' : ''}`}
                    onClick={() => handleAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="mission-progress">{solved} / {QUESTIONS_TARGET} correctas</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>
                Cancelar (Esc)
              </button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Caja cuadrada! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
