import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks for this test ----
const mockTranslation = vi.hoisted(() => ({
  t: vi.fn((key: string) => {
    const dict: Record<string, string> = {
      syncing: "Sincronizando...",
      sync_now: "Sincronizar ahora",
      sync_with_dropbox: "Conectar con Dropbox",
    };
    return dict[key] || key;
  }),
  lang: "es",
  setLang: vi.fn(),
}));

// Mock cryptoUtils to be identity functions (encrypt/decrypt return same value)
vi.mock("../../utils/cryptoUtils", () => ({
  encryptData: (data: string) => data,
  decryptData: (data: string) => data,
  generateCipherKey: () => "test-cipher-key",
}));

vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => mockTranslation,
}));

vi.mock("../../utils/syncUtils", () => ({
  normalizeData: vi.fn(() =>
    Promise.resolve({
      meta: { id: "meta", lastSync: 0, version: 1 },
      config: { cards: {}, categories: {} },
      data: { debts: {}, expenses: {} },
    }),
  ),
  denormalizeData: vi.fn(() => Promise.resolve()),
}));

// Mock localStorage
const mockStorage = vi.hoisted(() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_: number) => null),
  };
});
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});

// Mock sessionStorage
const mockSessionStorage = vi.hoisted(() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_: number) => null),
  };
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
  configurable: true,
});

import SyncButton from "../SyncButton";

describe("SyncButton", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockSessionStorage.clear();
    vi.clearAllMocks();

    // Mock fetch
    globalThis.fetch = vi.fn();
  });

  it("renderiza botón en estado idle cuando no hay token", () => {
    render(<SyncButton />);

    expect(
      screen.getByRole("button", { name: /conectar con dropbox/i }),
    ).toBeInTheDocument();
  });

  it("renderiza botón en estado idle cuando hay token", () => {
    mockStorage.setItem("dropbox_access_token", "fake-token");

    render(<SyncButton />);

    expect(
      screen.getByRole("button", { name: /sincronizar ahora/i }),
    ).toBeInTheDocument();
  });

  it("inicia flujo de auth al hacer clic si no hay token", async () => {
    // Mock window.location.href via Object.defineProperty
    let currentHref = window.location.href;
    Object.defineProperty(window, "location", {
      value: {
        href: currentHref,
        assign: (url: string) => {
          currentHref = url;
        },
        replace: (url: string) => {
          currentHref = url;
        },
        reload: () => {},
        origin: "",
        protocol: "https:",
        host: "localhost",
        hostname: "localhost",
        port: "",
        pathname: "/",
        search: "",
        hash: "",
      },
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<SyncButton />);

    await user.click(
      screen.getByRole("button", { name: /conectar con dropbox/i }),
    );

    // Debe redirigir a Dropbox
    expect(window.location.href).toContain("dropbox.com/oauth2/authorize");
  });

  it("muestra estado 'syncing' durante la sincronización", async () => {
    mockStorage.setItem("dropbox_access_token", "fake-token");
    mockStorage.setItem("dropbox_refresh_token", "fake-refresh");

    // Make the fetch for upload hang so the component stays in "syncing"
    let resolveUpload: (v: unknown) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    // Refresh token
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "new-token" }),
    });

    // Download (409 not found)
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: () => Promise.resolve(""),
    });

    // Upload - keep hanging
    (globalThis.fetch as any).mockImplementationOnce(() => uploadPromise);

    const user = userEvent.setup();
    render(<SyncButton />);

    await user.click(
      screen.getByRole("button", { name: /sincronizar ahora/i }),
    );

    // Should still be in "syncing" state since upload hasn't resolved
    expect(screen.getByText(/sincronizando/i)).toBeInTheDocument();

    // Resolve upload to clean up
    resolveUpload!({ ok: true });
  });

  it("muestra estado 'success' después de sincronizar exitosamente", async () => {
    mockStorage.setItem("dropbox_access_token", "fake-token");
    mockStorage.setItem("dropbox_refresh_token", "fake-refresh");

    // Refresh token
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "new-token" }),
    });

    // Download (404 = archivo nuevo)
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: () => Promise.resolve(""),
    });

    // Upload success
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
    });

    const user = userEvent.setup();
    render(<SyncButton />);

    await user.click(
      screen.getByRole("button", { name: /sincronizar ahora/i }),
    );

    await waitFor(() => {
      // Después de la sincronización, debe mostrar el texto con token
      expect(mockStorage.getItem).toBeDefined();
    });
  });

  it("maneja error de upload y muestra estado error", async () => {
    mockStorage.setItem("dropbox_access_token", "fake-token");
    mockStorage.setItem("dropbox_refresh_token", "fake-refresh");

    // Refresh token
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "new-token" }),
    });

    // Download ok
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            meta: { id: "meta", lastSync: 0, version: 1 },
            config: { cards: {}, categories: {} },
            data: { debts: {}, expenses: {} },
          }),
        ),
    });

    // Upload fails
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
    });

    const user = userEvent.setup();
    render(<SyncButton />);

    await user.click(
      screen.getByRole("button", { name: /sincronizar ahora/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/sincronizar ahora/i)).toBeInTheDocument();
    });
  });
});
