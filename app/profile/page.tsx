"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/ui/BackButton";
import { getDeviceId } from "@/lib/device";

interface ProfileData {
  userId: string;
  ouraConnected: boolean;
  promptVersion: string | null;
}

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; deviceId: string; profile: ProfileData };

function Header() {
  return (
    <div
      className="px-6 pt-[22px] flex items-center justify-between"
      style={{ minHeight: "52px" }}
    >
      <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
        láyo
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline font-sans text-[11px] py-[10px] border-b border-[#F1EFE8] last:border-b-0">
      <span className="text-[#5F5E5A] font-medium">{label}</span>
      <span className="text-[#2C2C2A] text-right max-w-[85%] whitespace-nowrap overflow-hidden text-ellipsis">
        {value}
      </span>
    </div>
  );
}

function SwitchingDevicesBlock({ deviceId }: { deviceId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="bg-white border border-[#D3D1C7] rounded-[16px] px-4 py-4 mt-3">
      <p className="font-sans text-[13px] text-[#5F5E5A] leading-[1.5] mb-3">
        Switching devices? Copy this and paste it in when Láyo asks.
      </p>
      <div className="flex items-center gap-2 bg-[#F1EFE8] rounded-[10px] px-[10px] py-[10px]">
        <span className="flex-1 font-sans text-[10px] text-[#2C2C2A] whitespace-nowrap overflow-hidden text-ellipsis">
          {deviceId}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(deviceId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex-shrink-0 px-[10px] py-[6px] rounded-full border-[1.5px] border-solid border-[#D3D1C7] bg-white font-sans text-[12px] font-medium text-[#5F5E5A] cursor-pointer"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    const deviceId = getDeviceId();
    if (!deviceId) {
      router.push("/onboarding");
      return;
    }

    fetch("/api/profile", { headers: { "X-Device-ID": deviceId } })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
      })
      .then((profile: ProfileData) => {
        setState({ status: "ready", deviceId, profile });
      })
      .catch(() => {
        setState({ status: "error" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === "loading") {
    return (
      <div className="min-h-dvh bg-[#F1EFE8] flex items-center justify-center">
        <div className="font-display font-bold text-[52px] text-[#0F6E56] tracking-[-0.5px]">
          láyo
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-dvh bg-[#F1EFE8] flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display font-bold text-[20px] text-[#2C2C2A] mb-2">
            Couldn&apos;t load your profile
          </h1>
          <p className="font-sans text-[13px] text-[#888780] max-w-[260px]">
            Check your connection and reload the page.
          </p>
        </div>
      </div>
    );
  }

  const { deviceId, profile } = state;

  return (
    <div className="min-h-dvh bg-[#F1EFE8]">
      <Header />
      <div className="px-6 pt-5">
        <BackButton onClick={() => router.push("/")} />
      </div>
      <div className="px-6 pt-5 pb-8">
        <h1 className="font-display font-bold text-[24px] text-[#2C2C2A] mb-4">
          Profile
        </h1>
        <div className="bg-white border border-[#D3D1C7] rounded-[16px] px-4 py-[14px]">
          <ProfileRow label="User ID" value={profile.userId} />
          <ProfileRow
            label="Oura Ring"
            value={profile.ouraConnected ? "Connected" : "Not connected"}
          />
          <ProfileRow
            label="Recommendation Engine"
            value={profile.promptVersion ?? "Unknown"}
          />
        </div>
        <SwitchingDevicesBlock deviceId={deviceId} />
      </div>
    </div>
  );
}
