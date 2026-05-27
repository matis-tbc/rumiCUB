/**
 * SolverContext — owns the solver suggestion + Solver Eye toggle state.
 *
 * State machine:
 *   OFF → (toggle on) → check pending → run injected cancelPending() if any
 *      → check suggestion freshness → fetch if stale → PREVIEW
 *      → (toggle off OR PLAY THIS OR game ends) → OFF
 *
 * Why the cancelPending callback: pendingBoard / pendingHand live in
 * Game.tsx (not here). Game.tsx injects its cancel fn via setCancelPending
 * on mount so we can revert pending changes before previewing without
 * hoisting all game state into this provider.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type SuggestResponse } from "./api";

type ToggleResult =
  | { kind: "noop" }
  | { kind: "off" }
  | { kind: "on"; cancelledPending: boolean };

interface SolverContextValue {
  suggestion: SuggestResponse | null;
  setSuggestion: (s: SuggestResponse | null) => void;

  solverEyeOn: boolean;
  toggleSolverEye: (gameId: string) => Promise<ToggleResult>;
  exitPreview: () => void;

  fetching: boolean;
  fetchError: string | null;
  retryFetch: (gameId: string) => Promise<void>;

  ilpAvailable: boolean;
  setIlpAvailable: (v: boolean) => void;

  // Game.tsx injects its cancelPending here; SolverContext calls it before
  // entering preview if pending changes exist.
  setCancelPending: (fn: (() => number) | null) => void;
}

const SolverContext = createContext<SolverContextValue | null>(null);

const FETCH_TIMEOUT_MS = 5_000;

export function SolverProvider({ children }: { children: ReactNode }) {
  const [suggestion, setSuggestion] = useState<SuggestResponse | null>(null);
  const [solverEyeOn, setSolverEyeOn] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [ilpAvailable, setIlpAvailable] = useState(false);

  // Game.tsx-owned cancel fn. Returns the count of pending changes it
  // cancelled (0 if no changes existed). Kept in a ref so updates to
  // Game.tsx's cancelPending don't blow away in-flight toggle logic.
  const cancelPendingRef = useRef<(() => number) | null>(null);
  const setCancelPending = useCallback((fn: (() => number) | null) => {
    cancelPendingRef.current = fn;
  }, []);

  const inflight = useRef(false);

  const fetchWithTimeout = useCallback(
    async (gameId: string): Promise<{ ok: true; data: SuggestResponse } | { ok: false; reason: string }> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const s = await api.suggest(gameId, true, controller.signal);
        clearTimeout(timer);
        return { ok: true, data: s };
      } catch (e) {
        clearTimeout(timer);
        const reason = controller.signal.aborted
          ? "the move space is too big right now"
          : "could not compute";
        void e;
        return { ok: false, reason };
      }
    },
    [],
  );

  const doFetch = useCallback(
    async (gameId: string) => {
      if (inflight.current) return;
      inflight.current = true;
      setFetching(true);
      setFetchError(null);
      try {
        const r = await fetchWithTimeout(gameId);
        if (r.ok) {
          setSuggestion(r.data);
        } else {
          setFetchError(r.reason);
        }
      } finally {
        inflight.current = false;
        setFetching(false);
      }
    },
    [fetchWithTimeout],
  );

  const toggleSolverEye = useCallback(
    async (gameId: string): Promise<ToggleResult> => {
      const nextOn = !solverEyeOn;
      setSolverEyeOn(nextOn);

      if (!nextOn) {
        setFetchError(null);
        return { kind: "off" };
      }

      if (!ilpAvailable) {
        // Toggle still flips on (user can see the empty state), but no fetch
        return { kind: "on", cancelledPending: false };
      }

      // Auto-cancel pending changes before previewing (E3 / D1)
      let cancelled = 0;
      if (cancelPendingRef.current) {
        cancelled = cancelPendingRef.current();
      }

      // E2: freshness invalidation. applyServerState already nukes
      // suggestion when the server state changes, so a non-null suggestion
      // here is by definition fresh. But: re-fetch anyway after a pending
      // cancel since the pre-cancel suggestion was based on potentially
      // different state.
      if (!suggestion || cancelled > 0) {
        await doFetch(gameId);
      }
      return { kind: "on", cancelledPending: cancelled > 0 };
    },
    [solverEyeOn, ilpAvailable, suggestion, doFetch],
  );

  const exitPreview = useCallback(() => {
    setSolverEyeOn(false);
    setFetchError(null);
    // Keep suggestion cached for the sidebar card; applyServerState will
    // clear it on the next server-state change.
  }, []);

  const retryFetch = useCallback(
    async (gameId: string) => {
      await doFetch(gameId);
    },
    [doFetch],
  );

  // Auto-exit preview when the game ends (winner declared). Game.tsx flips
  // solverEyeOn off via exitPreview when state.is_over hits true via the
  // useEffect-on-server-state pattern below.
  useEffect(() => {
    // The dependent reset lives in Game.tsx since this provider doesn't
    // see GameStateDTO directly. Pattern: Game effect calls exitPreview()
    // when state.is_over flips true.
  }, []);

  return (
    <SolverContext.Provider
      value={{
        suggestion,
        setSuggestion,
        solverEyeOn,
        toggleSolverEye,
        exitPreview,
        fetching,
        fetchError,
        retryFetch,
        ilpAvailable,
        setIlpAvailable,
        setCancelPending,
      }}
    >
      {children}
    </SolverContext.Provider>
  );
}

export function useSolver(): SolverContextValue {
  const ctx = useContext(SolverContext);
  if (!ctx) {
    throw new Error("useSolver must be used inside <SolverProvider>");
  }
  return ctx;
}
