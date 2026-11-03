import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import "./ScrollAnimations.css";

const READY_CLASS = "scroll-animations-enabled";

export default function ScrollAnimations() {
  const location = useLocation();
  const initialized = useRef(false);
  const failed = useRef(false);
  const previousPathname = useRef(null);

  useLayoutEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;

    // Reset before AOS measures the incoming page; passive page effects run too late.
    if (previousPathname.current !== location.pathname) {
      const behavior = root.style.getPropertyValue("scroll-behavior");
      const priority = root.style.getPropertyPriority("scroll-behavior");
      try {
        root.style.setProperty("scroll-behavior", "auto", "important");
        window.scrollTo(0, 0);
      } finally {
        if (behavior) root.style.setProperty("scroll-behavior", behavior, priority);
        else root.style.removeProperty("scroll-behavior");
      }
      previousPathname.current = location.pathname;
    }

    // Fail open: animation failures must never hide content or block controls.
    const run = (refreshOnly = false) => {
      if (failed.current || preference?.matches) {
        root.classList.remove(READY_CLASS);
        return;
      }
      try {
        root.classList.add(READY_CLASS);
        if (!initialized.current) {
          AOS.init({
            duration: 1000,
            easing: "ease",
            offset: 0,
            once: true,
            mirror: false,
            disableMutationObserver: false,
          });
          initialized.current = true;
        }
        if (refreshOnly) AOS.refresh();
        else AOS.refreshHard();
      } catch (error) {
        failed.current = true;
        root.classList.remove(READY_CLASS);
      }
    };

    run();
    const onPreferenceChange = () => run();
    const onImageLoad = (event) => {
      if (event.target instanceof HTMLImageElement) run(true);
    };
    preference?.addEventListener?.("change", onPreferenceChange);
    document.addEventListener("load", onImageLoad, true);
    return () => {
      preference?.removeEventListener?.("change", onPreferenceChange);
      document.removeEventListener("load", onImageLoad, true);
      root.classList.remove(READY_CLASS);
    };
  }, [location.key, location.pathname]);

  return null;
}
