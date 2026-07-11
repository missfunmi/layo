// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";

afterEach(cleanup);

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockGetDeviceId = vi.fn();

vi.mock("@/lib/device", () => ({
  getDeviceId: () => mockGetDeviceId(),
}));

const mockWriteText = vi.fn();

beforeEach(() => {
  mockPush.mockReset();
  mockGetDeviceId.mockReset();
  mockGetDeviceId.mockReturnValue("test-device-id");
  global.fetch = vi.fn();
  mockWriteText.mockReset();
  mockWriteText.mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText: mockWriteText } });
});

import ProfilePage from "@/app/profile/page";

interface ProfileData {
  userId: string;
  ouraConnected: boolean;
  promptVersion: string | null;
}

const PROFILE: ProfileData = {
  userId: "user-123",
  ouraConnected: true,
  promptVersion: "v1.2.0",
};

function mockFetchSuccess(profile: ProfileData = PROFILE) {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(profile), { status: 200 }),
  );
}

// ─── No deviceId ──────────────────────────────────────────────────────────────

describe("app/profile/page.tsx — no deviceId", () => {
  test("redirects to /onboarding when no deviceId is in localStorage", async () => {
    mockGetDeviceId.mockReturnValue(null);
    render(<ProfilePage />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding");
    });
  });

  test("does not call GET /api/profile when no deviceId is present", async () => {
    mockGetDeviceId.mockReturnValue(null);
    render(<ProfilePage />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding");
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe("app/profile/page.tsx — loading state", () => {
  test("shows Láyo wordmark while loading", () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);
    expect(screen.getByText("láyo")).toBeInTheDocument();
  });
});

// ─── Fetch call ───────────────────────────────────────────────────────────────

describe("app/profile/page.tsx — fetch call", () => {
  test("fetches GET /api/profile with the device ID header", async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/profile", {
        headers: { "X-Device-ID": "test-device-id" },
      });
    });
  });
});

// ─── Success state ────────────────────────────────────────────────────────────

describe("app/profile/page.tsx — success state", () => {
  test("displays the deviceId from localStorage", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("test-device-id")).toBeInTheDocument();
    });
  });

  test("displays the userId from the API response", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("user-123")).toBeInTheDocument();
    });
  });

  test('displays "Connected" when ouraConnected is true', async () => {
    mockFetchSuccess({ ...PROFILE, ouraConnected: true });
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
  });

  test('displays "Not connected" when ouraConnected is false', async () => {
    mockFetchSuccess({ ...PROFILE, ouraConnected: false });
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Not connected")).toBeInTheDocument();
    });
  });

  test("displays the Recommendation Engine from promptVersion", async () => {
    mockFetchSuccess({ ...PROFILE, promptVersion: "v1.2.0" });
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("v1.2.0")).toBeInTheDocument();
    });
  });

  test('displays "Unknown" for Recommendation Engine when promptVersion is null', async () => {
    mockFetchSuccess({ ...PROFILE, promptVersion: null });
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  test("back button navigates to the app root", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Go back")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Go back"));
    expect(mockPush).toHaveBeenCalledWith("/");
  });
});

// ─── Single-line values (LAYO-131) ───────────────────────────────────────────

describe("app/profile/page.tsx — single-line values", () => {
  test("User ID value does not wrap (regression: LAYO-131)", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("user-123")).toHaveClass("whitespace-nowrap");
    });
  });

  test("row labels never shrink or wrap, even under width pressure from a long value", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("User ID")).toHaveClass("flex-shrink-0");
    });
  });

  test("User ID, Oura Ring, and Recommendation Engine rows share the same font-size", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("user-123")).toBeInTheDocument();
    });
    const rows = [
      screen.getByText("User ID").closest("div"),
      screen.getByText("Oura Ring").closest("div"),
      screen.getByText("Recommendation Engine").closest("div"),
    ];
    const fontSizeClasses = rows.map((row) => {
      const match = row?.className.match(/text-\[\d+px\]/);
      return match?.[0];
    });
    expect(fontSizeClasses[0]).toBeDefined();
    expect(fontSizeClasses[1]).toBe(fontSizeClasses[0]);
    expect(fontSizeClasses[2]).toBe(fontSizeClasses[0]);
  });
});

// ─── Switching-devices block ─────────────────────────────────────────────────

describe("app/profile/page.tsx — switching-devices block", () => {
  test("shows the switching-devices instructional text", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(
        screen.getByText("Switching devices? Copy this and paste it in when Láyo asks."),
      ).toBeInTheDocument();
    });
  });

  test("shows the deviceId value in the switching-devices block", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("test-device-id")).toBeInTheDocument();
    });
  });

  test("deviceId value does not wrap (regression: LAYO-131)", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("test-device-id")).toHaveClass("whitespace-nowrap");
    });
  });

  test("copy button copies the deviceId to the clipboard", async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(mockWriteText).toHaveBeenCalledWith("test-device-id");
  });

  test('copy button shows "Copied" after being clicked', async () => {
    mockFetchSuccess();
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
    });
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe("app/profile/page.tsx — error state", () => {
  test("shows an error message when the fetch throws a network error", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));
    render(<ProfilePage />);
    await waitFor(() => {
      expect(
        screen.getByText("Couldn't load your profile"),
      ).toBeInTheDocument();
    });
  });

  test("shows an error message when the API returns a non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );
    render(<ProfilePage />);
    await waitFor(() => {
      expect(
        screen.getByText("Couldn't load your profile"),
      ).toBeInTheDocument();
    });
  });
});
