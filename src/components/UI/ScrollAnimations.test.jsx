import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import AOS from "aos";
import ScrollAnimations from "./ScrollAnimations";

jest.mock("aos", () => ({
  init: jest.fn(),
  refresh: jest.fn(),
  refreshHard: jest.fn(),
}));

function RoutesForTest() {
  const navigate = useNavigate();
  return <>
    <ScrollAnimations />
    <button onClick={() => navigate("/explore")}>Explore</button>
    <button onClick={() => navigate("/")}>Home</button>
    <button onClick={() => navigate("/?filter=price_low_to_high")}>Filter</button>
    <img src="/item.png" alt="Item" />
  </>;
}

describe("scroll animation lifecycle", () => {
  let preference;
  let onPreferenceChange;
  const originalMatchMedia = window.matchMedia;
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    jest.resetAllMocks();
    preference = {
      matches: false,
      addEventListener: jest.fn((event, listener) => { onPreferenceChange = listener; }),
      removeEventListener: jest.fn(),
    };
    window.matchMedia = jest.fn(() => preference);
    window.scrollTo = jest.fn();
    document.documentElement.className = "";
    document.documentElement.style.removeProperty("scroll-behavior");
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.scrollTo = originalScrollTo;
    document.documentElement.className = "";
    document.documentElement.style.removeProperty("scroll-behavior");
  });

  const mount = () => render(<MemoryRouter><RoutesForTest /></MemoryRouter>);

  it("enables animation styles before AOS measures elements and removes them on failure", () => {
    const expectEnabled = () => {
      expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(true);
    };
    AOS.init.mockImplementation(expectEnabled);
    AOS.refreshHard.mockImplementation(expectEnabled);
    mount();
    expect(AOS.init).toHaveBeenCalledTimes(1);
    expect(AOS.refreshHard).toHaveBeenCalledTimes(1);
    AOS.refreshHard.mockImplementation(() => {
      expectEnabled();
      throw new Error("Animation measurement unavailable");
    });
    fireEvent.click(screen.getByText("Explore"));
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(false);
  });

  it("resets pathname navigation before measuring, but preserves scroll for query changes", () => {
    mount();
    const calls = [];
    document.documentElement.style.setProperty("scroll-behavior", "smooth", "important");
    window.scrollTo.mockImplementation(() => {
      expect(document.documentElement.style.scrollBehavior).toBe("auto");
      calls.push("scroll");
    });
    AOS.refreshHard.mockImplementation(() => calls.push("refresh"));
    fireEvent.click(screen.getByText("Filter"));
    expect(calls).toEqual(["refresh"]);
    calls.length = 0;
    fireEvent.click(screen.getByText("Explore"));
    expect(calls).toEqual(["scroll", "refresh"]);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
    expect(document.documentElement.style.scrollBehavior).toBe("smooth");
    expect(document.documentElement.style.getPropertyPriority("scroll-behavior")).toBe("important");
  });

  it("initializes once, observes dynamic nodes, and refreshes after navigation and late images", () => {
    const { unmount } = mount();
    expect(AOS.init).toHaveBeenCalledWith({
      duration: 1000, easing: "ease", offset: 0, once: true, mirror: false,
      disableMutationObserver: false,
    });
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(true);
    fireEvent.click(screen.getByText("Explore"));
    fireEvent.click(screen.getByText("Home"));
    expect(AOS.init).toHaveBeenCalledTimes(1);
    expect(AOS.refreshHard).toHaveBeenCalledTimes(3);
    fireEvent.load(screen.getByAltText("Item"));
    expect(AOS.refresh).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(false);
    expect(preference.removeEventListener).toHaveBeenCalled();
  });

  it("keeps content visible for reduced motion and responds when the preference changes", () => {
    preference.matches = true;
    mount();
    expect(AOS.init).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(false);
    preference.matches = false;
    onPreferenceChange();
    expect(AOS.init).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(true);
    preference.matches = true;
    onPreferenceChange();
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(false);
  });

  it("fails open when initialization fails and keeps route controls usable", () => {
    AOS.init.mockImplementation(() => { throw new Error("Animation unavailable"); });
    mount();
    fireEvent.click(screen.getByText("Explore"));
    expect(AOS.init).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(false);
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("fails open when a route or image refresh fails", () => {
    mount();
    AOS.refresh.mockImplementation(() => { throw new Error("Refresh unavailable"); });
    fireEvent.load(screen.getByAltText("Item"));
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(false);
    fireEvent.click(screen.getByText("Explore"));
    expect(document.documentElement.classList.contains("scroll-animations-enabled")).toBe(false);
  });
});
