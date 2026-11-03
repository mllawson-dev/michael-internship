import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, useNavigate } from "react-router-dom";
import Author from "./Author";

const originalFetch = global.fetch;
const profile = {
  authorId: 83937449, authorName: "Monica Lucas", tag: "monicaaa",
  address: "wallet-address", authorImage: "https://example.com/author.jpg", followers: 506,
  nftCollection: [{ id: 1, nftId: 123, title: "Pinky Ocean", nftImage: "https://example.com/nft.jpg", price: 5.07, likes: 69 }],
};
const response = (data) => ({ ok: true, text: async () => data === "" ? "" : JSON.stringify(data) });
const respond = (data) => { global.fetch = jest.fn().mockResolvedValue(response(data)); };
function Navigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/author?authorId=456")}>Next author</button>;
}
function show(path = "/author") {
  return render(<MemoryRouter initialEntries={[path]}><Navigation /><Author /></MemoryRouter>);
}
afterEach(() => { global.fetch = originalFetch; });

test("loads default author and reuses cards with API prices, likes and links", async () => {
  respond(profile);
  const { container } = show();
  expect(await screen.findByRole("heading", { name: /Monica Lucas/ })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/authors?author=83937449"), expect.objectContaining({ signal: expect.anything() }));
  expect(screen.getByText("@monicaaa")).toBeInTheDocument();
  expect(screen.getByText("wallet-address")).toBeInTheDocument();
  expect(screen.getByText("506 followers")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Monica Lucas" })).toHaveAttribute("src", profile.authorImage);
  const card = within(screen.getByRole("list", { name: "Author items" }));
  expect(card.getByText("5.07 ETH")).toBeInTheDocument();
  expect(card.getByLabelText("69 likes")).toBeInTheDocument();
  expect(card.getByRole("link", { name: "View creator of Pinky Ocean" })).toHaveAttribute("href", "/author?authorId=83937449");
  card.getAllByRole("link", { name: "Pinky Ocean" }).forEach((link) => expect(link).toHaveAttribute("href", "/item-details?nftId=123"));
  expect(container.querySelector(".de_countdown")).not.toBeInTheDocument();
});

test("Follow adds one follower and Unfollow restores the API count without writes", async () => {
  respond(profile);
  show();
  const follow = await screen.findByRole("button", { name: "Follow" });
  expect(follow).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(follow);
  expect(screen.getByRole("button", { name: "Unfollow" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("507 followers")).toBeInTheDocument();
  fireEvent.click(follow);
  expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("506 followers")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("uses requested author identity and resets Follow on profile navigation", async () => {
  const other = { ...profile, authorId: 456, authorName: "Other author" };
  global.fetch = jest.fn().mockResolvedValueOnce(response(profile)).mockResolvedValueOnce(response(other));
  show("/author?authorId=83937449");
  fireEvent.click(await screen.findByRole("button", { name: "Follow" }));
  fireEvent.click(screen.getByRole("button", { name: "Next author" }));
  expect(await screen.findByRole("heading", { name: /Other author/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute("aria-pressed", "false");
  expect(global.fetch.mock.calls[1][0]).toMatch(/author=456$/);
});

test("supports API-style author query", async () => {
  respond({ ...profile, authorId: 456 });
  show("/author?author=456");
  await screen.findByRole("button", { name: "Follow" });
  expect(global.fetch.mock.calls[0][0]).toMatch(/author=456$/);
});

test.each(["", "abc", "-1", "0", "9007199254740992"])("rejects invalid author identity %s before fetching", (id) => {
  respond(profile);
  show(`/author?authorId=${id}`);
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to load author");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("shows skeletons while loading and aborts on unmount", () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  const { container, unmount } = show();
  expect(screen.getByRole("status", { name: "Loading author" })).toHaveAttribute("aria-busy", "true");
  expect(container.querySelectorAll(".author-items-grid > div")).toHaveLength(8);
  const signal = global.fetch.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});

test("ignores stale author responses after navigating", async () => {
  let resolveOld;
  global.fetch = jest.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce(response({ ...profile, authorId: 456, authorName: "Other author" }));
  show();
  fireEvent.click(screen.getByRole("button", { name: "Next author" }));
  await screen.findByRole("heading", { name: /Other author/ });
  await act(async () => { resolveOld(response(profile)); });
  expect(screen.queryByRole("heading", { name: /Monica Lucas/ })).not.toBeInTheDocument();
});

test.each([null, ""])("shows author not found for missing API data %j", async (data) => {
  respond(data);
  show();
  expect(await screen.findByText("Author not found.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
});

test("shows empty collection while preserving the profile", async () => {
  respond({ ...profile, nftCollection: [] });
  show();
  expect(await screen.findByText("No items available from this author.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
});

test.each([{}, { ...profile, authorId: 456 }, { ...profile, followers: -1 }, { ...profile, nftCollection: [{}] }, { ...profile, authorName: "" }])("fails closed on malformed author %j", async (data) => {
  respond(data);
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load author");
  expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
});

test.each(["http", "network", "json"])("shows error on %s failure", async (kind) => {
  global.fetch = jest.fn().mockImplementation(async () => {
    if (kind === "network") throw new Error("Offline");
    return { ok: kind !== "http", text: async () => "invalid-json" };
  });
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load author");
});
