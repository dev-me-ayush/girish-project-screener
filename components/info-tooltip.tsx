"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { InfoIcon } from "@/components/icons";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface InfoTooltipProps {
  text: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function InfoTooltip({ text, className = "", side = "top" }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const isMounted = useMounted();

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 224; // w-56
    const tooltipHeight = 56; // estimated default height
    const gap = 8;

    let top = 0;
    let left = 0;

    if (side === "top") {
      top = rect.top - tooltipHeight - gap;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      // If clipped above top of viewport, flip to bottom
      if (top < 10) {
        top = rect.bottom + gap;
      }
    } else if (side === "bottom") {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      // If clipped below bottom of viewport, flip to top
      if (typeof window !== "undefined" && top + tooltipHeight > window.innerHeight - 10) {
        top = rect.top - tooltipHeight - gap;
      }
    } else if (side === "left") {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - gap;
    } else {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + gap;
    }

    if (typeof window !== "undefined") {
      left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
      top = Math.max(8, top);
    }

    setCoords({ top, left });
  };

  const handleShow = () => {
    updatePosition();
    setIsVisible(true);
  };

  const handleHide = () => {
    setIsVisible(false);
  };

  // Close on scroll or window resize to prevent detached floating tooltips
  useEffect(() => {
    if (!isVisible) return;
    const handleScrollOrResize = () => setIsVisible(false);
    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isVisible]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex items-center justify-center cursor-help text-zinc-500 hover:text-paper transition-colors shrink-0 ${className}`}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
        tabIndex={0}
        role="button"
        aria-label={text}
      >
        <InfoIcon className="h-3 w-3" />
      </span>

      {isMounted &&
        isVisible &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
            }}
            className="pointer-events-none w-56 rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-[11px] font-sans font-normal leading-relaxed text-zinc-200 shadow-2xl backdrop-blur-md animate-in fade-in duration-100"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}
