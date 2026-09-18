import { useEffect, useState, type RefObject } from 'react';

/** 손을 멈추고 이만큼 지나면 다시 올라온다 */
const SHOW_AFTER_STOP_MS = 1500;
/** 이만큼은 움직여야 스크롤로 본다 — 손 떨림이나 튕김으로 깜빡이지 않게 한다 */
const MOVE_THRESHOLD_PX = 8;
/** 맨 위·맨 아래로 보는 여유 */
const EDGE_PX = 24;

/**
 * 읽어 내려가는 동안 하단 탭바를 치워 둔다.
 *
 * - 아래로 내리면 숨고, 위로 올리면 바로 올라온다
 * - 손을 멈추고 {@link SHOW_AFTER_STOP_MS} 가 지나도 올라온다
 * - 맨 위와 맨 아래에서는 항상 보인다 (탭을 바꾸려는 자리다)
 *
 * @param ref 스크롤이 일어나는 요소
 * @param resetKey 이 값이 바뀌면(탭 전환 등) 다시 보이는 상태에서 시작한다
 */
export function useAutoHideOnScroll(ref: RefObject<HTMLElement | null>, resetKey?: unknown): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    const el = ref.current;
    if (!el) return;

    let lastY = el.scrollTop;
    let idleTimer = 0;

    const onScroll = () => {
      const y = el.scrollTop;
      const dy = y - lastY;
      // 문턱을 넘을 때까지 lastY 를 두면 천천히 굴려도 결국 방향이 잡힌다
      if (Math.abs(dy) < MOVE_THRESHOLD_PX) return;
      lastY = y;

      const atTop = y <= EDGE_PX;
      const atBottom = y + el.clientHeight >= el.scrollHeight - EDGE_PX;
      setHidden(dy > 0 && !atTop && !atBottom);

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setHidden(false), SHOW_AFTER_STOP_MS);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(idleTimer);
    };
  }, [ref, resetKey]);

  return hidden;
}
