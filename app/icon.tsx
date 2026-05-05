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
          <path
            d="M10 7.5h7.2C22.7 7.5 27 11.6 27 18s-4.3 10.5-9.8 10.5H10V7.5Z"
            stroke="rgba(248,250,252,0.90)"
            strokeWidth="2.15"
            strokeLinejoin="round"
          />
          <line
            x1="18.6" y1="8.3"
            x2="18.6" y2="27.7"
            stroke="#F59E0B"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
