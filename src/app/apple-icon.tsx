import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4efe6",
          borderRadius: 40,
          border: "3px solid #d4cdc0",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="9" stroke="#1a5c45" strokeWidth="1.2" opacity="0.35" />
          <circle cx="16" cy="16" r="5.5" stroke="#1a5c45" strokeWidth="1.2" opacity="0.55" />
          <path d="M16 16 L23.6 12" stroke="#1a5c45" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="24.1" cy="11.7" r="1.6" fill="#1a5c45" />
          <circle cx="16" cy="16" r="1.8" fill="#1a5c45" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
