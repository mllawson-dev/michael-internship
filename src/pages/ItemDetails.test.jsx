import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, useNavigate } from "react-router-dom";
import ItemDetails from "./ItemDetails";

const originalFetch = global.fetch;
const originalScroll = window.scrollTo;
const item = {
  id: 51, nftId: 17914494, title: "Cartoonism", tag: 942, description: "Item description",
  nftImage: "https://example.com/nft.jpg", ownerName: "Lori Hart", ownerId: 73855012,
  ownerImage: "https://example.com/owner.jpg", creatorName: "Nicholas Daniels", creatorId: 55757699,
  creatorImage: "https://example.com/creator.jpg", price: 0.29, likes: 234, views: 468,
};
const response = (data) => ({ ok: true, text: async () => data === "" ? "" : JSON.stringify(data) });
const respond = (data) => { global.fetch = jest.fn().mockResolvedValue(response(data)); };
function Navigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/item-details?nftId=123")}>Next item</button>;
}
function show(path = "/item-details") {
  return render(<MemoryRouter initialEntries={[path]}><Navigation /><ItemDetails /></MemoryRouter>);
}
beforeEach(() => { window.scrollTo = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; window.scrollTo = originalScroll; });

test("shows API item details, price, stats and separate owner and creator links", async () => {
  respond(item);
  show();
  expect(await screen.findByRole("heading", { name: "Cartoonism #942" })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("https://us-central1-nft-cloud-functions.cloudfunctions.net/itemDetails?nftId=17914494", expect.objectContaining({ signal: expect.anything() }));
  expect(screen.getByRole("img", { name: "Cartoonism" })).toHaveAttribute("src", item.nftImage);
  expect(screen.getByText("Item description")).toBeInTheDocument();
  expect(screen.getByLabelText("0.29 ETH")).toBeInTheDocument();
  expect(screen.getByLabelText("234 likes")).toBeInTheDocument();
  expect(screen.getByLabelText("468 views")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Lori Hart" })).toHaveAttribute("href", "/author?authorId=73855012");
  expect(screen.getByRole("link", { name: "Nicholas Daniels" })).toHaveAttribute("href", "/author?authorId=55757699");
  expect(screen.getByRole("link", { name: "View owner Lori Hart" }).querySelector("img")).toHaveAttribute("src", item.ownerImage);
  expect(screen.getByRole("link", { name: "View creator Nicholas Daniels" }).querySelector("img")).toHaveAttribute("src", item.creatorImage);
  expect(screen.queryByText(/Rainbow Style/)).not.toBeInTheDocument();
});

test.each(["nftId", "nftid"])("uses requested item from %s query", async (key) => {
  respond({ ...item, nftId: 123 });
  show(`/item-details?${key}=123`);
  await screen.findByRole("heading", { name: "Cartoonism #942" });
  expect(global.fetch.mock.calls[0][0]).toMatch(/nftId=123$/);
});

test.each(["", "abc", "-1", "0", "1.5", "9007199254740992"])("rejects invalid identity %s before requesting data", (id) => {
  respond(item);
  show(`/item-details?nftId=${id}`);
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to load item details");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("shows skeletons while loading and aborts the request on unmount", () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  const { container, unmount } = show();
  expect(screen.getByRole("status", { name: "Loading item details" })).toHaveAttribute("aria-busy", "true");
  expect(container.querySelectorAll(".skeleton-box")).toHaveLength(7);
  const signal = global.fetch.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});

test.each(["", null])("shows a not-found state for an empty body or null", async (data) => {
  respond(data);
  show();
  expect(await screen.findByText("Item not found.")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test.each(["http", "network", "json", "shape", "identity", "negative", "person"])("handles %s errors without rendering guessed details", async (failure) => {
  if (failure === "http") global.fetch = jest.fn().mockResolvedValue({ ok: false });
  if (failure === "network") global.fetch = jest.fn().mockRejectedValue(new Error("Offline"));
  if (failure === "json") global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => "not JSON" });
  if (failure === "shape") respond({ title: "Wrong shape" });
  if (failure === "identity") respond({ ...item, nftId: 456 });
  if (failure === "negative") respond({ ...item, price: -1 });
  if (failure === "person") respond({ ...item, ownerId: 0 });
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load item details");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

test("renders zero price, likes, views and tag", async () => {
  respond({ ...item, price: 0, likes: 0, views: 0, tag: 0 });
  show();
  await screen.findByRole("heading", { name: "Cartoonism #0" });
  ["0 ETH", "0 likes", "0 views"].forEach((name) => expect(screen.getByLabelText(name)).toBeInTheDocument());
});

test("loads a new item on navigation and ignores the previous request finishing late", async () => {
  let resolveOld;
  global.fetch = jest.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce(response({ ...item, nftId: 123, title: "New item" }));
  show();
  const signal = global.fetch.mock.calls[0][1].signal;
  fireEvent.click(screen.getByRole("button", { name: "Next item" }));
  expect(await screen.findByRole("heading", { name: "New item #942" })).toBeInTheDocument();
  expect(signal.aborted).toBe(true);
  await act(async () => { resolveOld(response(item)); });
  expect(screen.queryByRole("heading", { name: "Cartoonism #942" })).not.toBeInTheDocument();
  expect(global.fetch.mock.calls[1][0]).toMatch(/nftId=123$/);
});
