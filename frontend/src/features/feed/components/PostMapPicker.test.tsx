// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import PostMapPicker from "./PostMapPicker";

const mapMock = vi.hoisted(() => ({
  listeners: new Map<string, (event?: unknown) => void>(),
  markerRemoved: vi.fn(),
  mapRemoved: vi.fn(),
  mapInit: vi.fn(),
  onConfirm: vi.fn(),
}));
vi.mock("maplibre-gl", () => ({
  setWorkerUrl: vi.fn(),
  Map: class {
    constructor(options: unknown) { mapMock.mapInit(options); }
    on(event: string, callback: (data: unknown) => void) { mapMock.listeners.set(event, callback); }
    addControl() {}
    resize() {}
    remove() { mapMock.mapRemoved(); }
    isStyleLoaded() { return true; }
    queryRenderedFeatures() { return []; }
  },
  Marker: class {
    setLngLat() { return this; }
    addTo() { return this; }
    remove() { mapMock.markerRemoved(); }
  },
  NavigationControl: class {},
}));
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });

afterEach(() => {
  mapMock.listeners.clear();
  for (const spy of [mapMock.mapInit, mapMock.mapRemoved, mapMock.markerRemoved, mapMock.onConfirm]) spy.mockClear();
});

it("initializes from an existing pin and cleans up the map and marker on unmount", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const value = "Hà Nội [map:21.03,105.85]";
  act(() => root.render(<PostMapPicker value={value} disabled={false} onConfirm={mapMock.onConfirm} />));
  expect(mapMock.mapInit).toHaveBeenCalledTimes(1);
  act(() => mapMock.listeners.get("load")?.());
  expect(container.querySelector("input")?.value).toBe("Hà Nội");
  act(() => root.unmount());
  expect(mapMock.markerRemoved).toHaveBeenCalledTimes(1);
  expect(mapMock.mapRemoved).toHaveBeenCalledTimes(1);
  container.remove();
});

it("does not retain an old marker after selecting a new point", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<PostMapPicker value="" disabled={false} onConfirm={mapMock.onConfirm} />));
  act(() => mapMock.listeners.get("load")?.());
  act(() => mapMock.listeners.get("click")?.({ lngLat: { wrap: () => ({ lat: 20, lng: 106 }) }, point: { x: 1, y: 2 } }));
  expect(container.textContent).toContain("20.000000");
  act(() => root.unmount());
  expect(mapMock.markerRemoved).toHaveBeenCalledTimes(1);
  container.remove();
});
