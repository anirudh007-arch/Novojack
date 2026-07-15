import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

// The living Nova orb: layered decorative rings (sonar ripples, a rotating
// conic aura, orbiting light dots, a breathing glow, a drifting inner shine)
// wrapped around the mic-toggle button at the core. Decorations are
// pointer-events-none so only the core button is clickable. Intensity ramps
// up from idle → listening → speaking.
export function NovaOrb({
  state,
  listening,
  onClick,
}: {
  state: "idle" | "listening" | "speaking";
  listening: boolean;
  onClick: () => void;
}) {
  const active = state !== "idle";
  return (
    <div className="nova-orb-wrap">
      <span className={cn("nova-orb-ripple", active && "nova-orb-ripple-active")} />
      <span className={cn("nova-orb-ripple nova-orb-ripple-2", active && "nova-orb-ripple-active")} />
      <span className={cn("nova-orb-ripple nova-orb-ripple-3", active && "nova-orb-ripple-active")} />

      <span className="nova-orb-aura" />
      <span className="nova-orb-glow" data-state={state} />

      <span className="nova-orb-orbit">
        <span className="nova-orb-dot" />
      </span>
      <span className="nova-orb-orbit nova-orb-orbit-2">
        <span className="nova-orb-dot nova-orb-dot-2" />
      </span>

      <button
        onClick={onClick}
        className={cn("nova-orb-core", listening && "nova-orb-core-listening")}
        aria-label={listening ? "Stop listening" : "Start listening"}
      >
        <span className="nova-orb-shine" />
        {listening ? (
          <MicOff className="relative z-10 size-10 text-white" />
        ) : (
          <Mic className="relative z-10 size-10 text-white" />
        )}
      </button>
    </div>
  );
}
