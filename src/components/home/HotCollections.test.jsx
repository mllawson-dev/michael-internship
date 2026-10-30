import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

const collections = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  title: `Collection ${index + 1}`,
  nftImage: `https://example.com/collection-${index}.jpg`,
  authorImage: `https://example.com/author-${index}.jpg`,
  code: 192 + index,
}));
const originalFetch = global.fetch;

// Enquire reads matchMedia at module load and keeps queries between mounts.
window.matchMedia = (query) => ({
  get matches() {
    return Array.from(query.matchAll(/(min|max)-width:\s*(\d+)px/g)).every(
      ([, bound, width]) => bound === "min"
        ? window.innerWidth >= Number(width)
        : window.innerWidth <= Number(width)
    );
  },
  media: query,
  addListener: () => {},
  removeListener: () => {},
});
const HotCollections = require("./HotCollections").default;

afterEach(() => {
  global.fetch = originalFetch;
});

const renderCollections = () => render(
  <MemoryRouter><HotCollections /></MemoryRouter>
);
const respondWith = (data) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => data });
};

test("shows skeletons while the request is pending and aborts on unmount", () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  const { container, unmount } = renderCollections();
  expect(screen.getByRole("status")).toHaveTextContent("Loading hot collections");
  expect(container.querySelectorAll(".hot-collections-skeletons .nft_coll")).toHaveLength(4);
  const [url, { signal }] = global.fetch.mock.calls[0];
  expect(url).toBe("https://us-central1-nft-cloud-functions.cloudfunctions.net/hotCollections");
  unmount();
  expect(signal.aborted).toBe(true);
});

test.each([[1440, 4], [1100, 3], [800, 2], [390, 1]])(
  "shows %i-pixel viewport with %i active cards and working side arrows",
  async (width, count) => {
    window.innerWidth = width;
    respondWith(collections);
    const { container } = renderCollections();
    await screen.findByRole("list", { name: "Hot collections" });
    await waitFor(() => expect(container.querySelectorAll(".slick-active")).toHaveLength(count));
    expect(screen.getByText("Collection 1")).toBeInTheDocument();
    expect(screen.getByText("ERC-192")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous collections" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next collections" }));
    await waitFor(() => expect(container.querySelector(".slick-active")).toHaveAttribute("data-index", "1"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous collections" })).toBeEnabled());
    // Wait for Slick's animation before returning to the first card via keyboard.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });
    fireEvent.keyDown(container.querySelector(".slick-list"), { keyCode: 37, key: "ArrowLeft" });
    await waitFor(() => expect(container.querySelector(".slick-active")).toHaveAttribute("data-index", "0"));
  }
);

test("shows an empty state for an empty response", async () => {
  respondWith([]);
  renderCollections();
  expect(await screen.findByText("No hot collections available.")).toBeInTheDocument();
});

test.each(["network", "http", "malformed", "json"])("shows an error for %s failure", async (failure) => {
  if (failure === "network") global.fetch = jest.fn().mockRejectedValue(new Error("Offline"));
  if (failure === "http") global.fetch = jest.fn().mockResolvedValue({ ok: false });
  if (failure === "malformed") respondWith({ collections });
  if (failure === "json") global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("Invalid JSON"); } });
  renderCollections();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load hot collections");
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});
