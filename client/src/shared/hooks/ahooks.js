/**
 * ahooks – Curated enterprise barrel.
 *
 * Single sanctioned gateway for `ahooks` utilities in this app.
 * Import from `shared/hooks` (re-exported below) instead of pulling
 * straight from the library, so we keep one auditable surface,
 * consistent naming, and can swap implementations later if ever needed.
 *
 * ── UI / DOM interaction ─────────────────────────────
 * useHover            – hover state for any element
 * useClickAway        – run handler on outside click (dropdowns, popovers)
 * useInViewport       – is element inside viewport (lazy render/analytics)
 * useDrag / useDrop   – drag & drop state machines (uploaders, kanban)
 * useTextSelection    – currently selected text
 *
 * ── Layout & viewport ───────────────────────────────
 * useSize             – reactive element dimensions (charts, responsive)
 * useScroll           – scroll position/state of element or page
 * useFullscreen       – fullscreen toggle for any element
 *
 * ── Environment awareness ───────────────────────────
 * useDocumentVisibility – tab visibility (pause polling/animations)
 * useOnline             – network online/offline
 * useNetwork            – full network info (downlink, rtt, type)
 * NOTE: useGeolocation is intentionally NOT re-exported here – this app
 * ships a high-accuracy custom version in useGeolocation.js.
 *
 * ── Input & timing ──────────────────────────────────
 * useKeyPress          – declarative keyboard shortcuts
 * useIdle                – user inactivity detection (auto-lock, presence)
 * useDebounceFn         – debounce any callback
 * useThrottleFn         – throttle any callback
 */
export {
  useHover,
  useClickAway,
  useMouse,
  useScroll,
  useSize,
  useFullscreen,
  useDocumentVisibility,
  useInViewport,
  useDrag,
  useDrop,
  useKeyPress,
  useTextSelection,
  useNetwork,
  useInterval,
  useDebounceFn,
  useThrottleFn,
  useMount,
  useUnmount,
  useUpdateEffect,
} from 'ahooks';
