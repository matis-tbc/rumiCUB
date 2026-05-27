import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type SuggestResponse } from "./api";

interface SolverContextValue {
  suggestion: SuggestResponse | null;
  setSuggestion: (s: SuggestResponse | null) => void;

  solverEyeOn: boolean;
  toggleSolverEye: (gameId: string) => Promise<void>;

  fetching: boolean;

  ilpAvailable: boolean;
  setIlpAvailable: (v: boolean) => void;
}

const SolverContext = createContext<SolverContextValue | null>(null);

export function SolverProvider({ children }: { children: ReactNode }) {
  const [suggestion, setSuggestion] = useState<SuggestResponse | null>(null);
  const [solverEyeOn, setSolverEyeOn] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [ilpAvailable, setIlpAvailable] = useState(false);

  // Prevent double-fire when the user spam-toggles
  const inflight = useRef(false);

  const toggleSolverEye = useCallback(
    async (gameId: string) => {
      const nextOn = !solverEyeOn;
      setSolverEyeOn(nextOn);

      // Only auto-fetch when turning ON and no suggestion exists yet.
      if (!nextOn) return;
      if (suggestion) return;
      if (!ilpAvailable) return;
      if (inflight.current) return;

      inflight.current = true;
      setFetching(true);
      try {
        const s = await api.suggest(gameId, true);
        setSuggestion(s);
      } catch {
        // Silent failure on the auto-fetch path. The user can still click
        // the explicit Suggest button to surface any backend error.
      } finally {
        inflight.current = false;
        setFetching(false);
      }
    },
    [solverEyeOn, suggestion, ilpAvailable],
  );

  return (
    <SolverContext.Provider
      value={{
        suggestion,
        setSuggestion,
        solverEyeOn,
        toggleSolverEye,
        fetching,
        ilpAvailable,
        setIlpAvailable,
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
