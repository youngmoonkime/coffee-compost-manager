import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * 숫자가 바뀔 때 이전 값에서 새 값까지 굴러가듯 올라간다.
 * 3지점 평균처럼 값이 툭툭 바뀌는 자리에서 변화가 눈에 들어오게 하는 용도.
 */
export function useCountUp(value: number | null, duration = 420): number | null {
  const [display, setDisplay] = useState(value ?? 0);
  const fromRef = useRef(value ?? 0);

  useEffect(() => {
    if (value === null) return;

    // 애니메이션을 줄이는 설정이면 한 프레임 뒤 최종값으로 바로 맞춘다
    const from = prefersReducedMotion() ? value : fromRef.current;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return value === null ? null : display;
}
