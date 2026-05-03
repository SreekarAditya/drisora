import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "16px",
          background: "#101113",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <svg width="50" height="50" viewBox="0 0 36 36" fill="none">
          <rect x="1" y="1" width="34" height="34" rx="8" fill="#111214" />
          <path
            d="M10.5 7.5h7.4c6 0 10 4.2 10 10.5s-4 10.5-10 10.5h-7.4V7.5Z"
            stroke="#F8FAFC"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M18.4 9.4c1.4 4.6 1.4 12.4 0 17.2"
            stroke="#F59E0B"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M18.4 13.6v2.4M18.4 20v2.4"
            stroke="#111214"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
