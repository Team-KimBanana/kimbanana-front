import { useEffect } from "react";

interface UsePresentationNavigationProps {
  isPresentationMode: boolean;
  goToNextSlide: () => void;
  goToPrevSlide: () => void;
}

export default function usePresentationNavigation({ isPresentationMode, goToNextSlide, goToPrevSlide }: UsePresentationNavigationProps) {
  useEffect(() => {
    if (!isPresentationMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goToNextSlide();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToPrevSlide();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPresentationMode, goToNextSlide, goToPrevSlide]);
}