import { useCallback, useEffect, useState } from "react";

export default function useFullscreen(targetRef: React.RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enter = useCallback(() => {
    if (targetRef.current?.requestFullscreen) {
      targetRef.current.requestFullscreen();
    }
  }, [targetRef]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return { isFullscreen, enter, exit };
}