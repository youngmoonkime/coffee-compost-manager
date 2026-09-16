import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * 숫자가 바뀔 때 이전 값에서 새 값까지 굴러가듯 올라간다.
 * 3지점 평균처럼 값이 툭툭 바뀌는 자리에서 변화가 눈에 들어오게 하는 용도.
 */
export function useCountUp(
  value: number | null,
  duration = 200,
  decimals = 1
): number | null {
  const [display, setDisplay] = useState<number | null>(value);
  const currentRef = useRef<number | null>(value);

  useEffect(() => {
    if (value === null) {
      currentRef.current = null;
      setDisplay(null);
      return;
    }

    // 초기 값이거나 모션 축소 설정이면 애니메이션 없이 즉시 반영
    if (currentRef.current === null || prefersReducedMotion() || duration <= 0) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    const from = currentRef.current;
    // 차이가 너무 작으면(0.05 미만) 애니메이션 생략
    if (Math.abs(value - from) < 0.05) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = from + (value - from) * eased;
      const rounded = Number(currentVal.toFixed(decimals));
      currentRef.current = currentVal;
      setDisplay(rounded);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        currentRef.current = value;
        setDisplay(value);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [value, duration, decimals]);

  return display;
}
