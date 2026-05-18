"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DetectionAnnotation, DetectionBox, DetectionMaskPolygon, FrameResult } from "@/types";

type FitMode = "cover" | "contain";

interface DetectionFrameImageProps {
  frame: FrameResult;
  alt: string;
  objectFit?: FitMode;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  placeholderClassName?: string;
  onError?: () => void;
}

interface Size {
  width: number;
  height: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function DetectionFrameImage({
  frame,
  alt,
  objectFit = "cover",
  className = "",
  imageClassName = "",
  placeholderClassName = "text-xs text-gray-700",
  onError,
}: DetectionFrameImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [showDetections, setShowDetections] = useState(true);
  const [imgError, setImgError] = useState(false);

  const annotations = frame.detection_annotations ?? [];
  const hasDetections = annotations.length > 0;
  const imageSrc = frame.overlay_url ?? frame.image_url ?? null;
  const sourceWidth = frame.image_width ?? naturalSize?.width ?? 1;
  const sourceHeight = frame.image_height ?? naturalSize?.height ?? 1;
  const sourceSize = useMemo(
    () => ({ width: sourceWidth, height: sourceHeight }),
    [sourceWidth, sourceHeight],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      setContainerSize({ width: node.clientWidth, height: node.clientHeight });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const imageRect = useMemo(() => {
    if (!containerSize) return null;
    return objectFitRect(containerSize, sourceSize, objectFit);
  }, [containerSize, objectFit, sourceSize]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {imageSrc && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={alt}
          className={`absolute inset-0 h-full w-full ${objectFit === "contain" ? "object-contain" : "object-cover"} ${imageClassName}`}
          onLoad={(event) => {
            const img = event.currentTarget;
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
          }}
          onError={() => {
            setImgError(true);
            onError?.();
          }}
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${placeholderClassName}`}>
          No overlay available
        </div>
      )}

      {hasDetections && (
        <label className="absolute left-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur">
          <input
            type="checkbox"
            checked={showDetections}
            onChange={(event) => setShowDetections(event.target.checked)}
            className="h-3 w-3 accent-amber-500"
          />
          Show detections
        </label>
      )}

      {hasDetections && showDetections && imageRect && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
          }}
        >
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${sourceSize.width} ${sourceSize.height}`} preserveAspectRatio="none">
            {annotations.flatMap((annotation) =>
              annotation.mask_polygons.map((polygon, index) => (
                <polygon
                  key={`${annotation.id}-mask-${index}`}
                  points={polygonPoints(polygon, sourceSize)}
                  fill="#f59e0b"
                  fillOpacity="0.22"
                  stroke="#f59e0b"
                  strokeOpacity="0.7"
                  strokeWidth={Math.max(sourceSize.width, sourceSize.height) * 0.003}
                />
              )),
            )}
          </svg>

          {annotations.map((annotation) =>
            annotation.box ? (
              <DetectionBoxView
                key={`${annotation.id}-box`}
                annotation={annotation}
                box={annotation.box}
                sourceSize={sourceSize}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function DetectionBoxView({
  annotation,
  box,
  sourceSize,
}: {
  annotation: DetectionAnnotation;
  box: DetectionBox;
  sourceSize: Size;
}) {
  const rect = boxRect(box, sourceSize);
  const label = annotation.confidence == null
    ? annotation.label
    : `${annotation.label} ${Math.round(annotation.confidence * 100)}%`;

  return (
    <div
      className="absolute border-2 border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
      style={{
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
      }}
    >
      <span className="absolute left-0 top-0 max-w-[220px] -translate-y-full truncate rounded-t bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black shadow">
        {label}
      </span>
    </div>
  );
}

function objectFitRect(container: Size, image: Size, fit: FitMode): Rect {
  const safeImage = { width: Math.max(1, image.width), height: Math.max(1, image.height) };
  const scale = fit === "cover"
    ? Math.max(container.width / safeImage.width, container.height / safeImage.height)
    : Math.min(container.width / safeImage.width, container.height / safeImage.height);
  const width = safeImage.width * scale;
  const height = safeImage.height * scale;
  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  };
}

function boxRect(box: DetectionBox, sourceSize: Size) {
  const x = box.normalized ? box.x * sourceSize.width : box.x;
  const y = box.normalized ? box.y * sourceSize.height : box.y;
  const width = box.normalized ? box.width * sourceSize.width : box.width;
  const height = box.normalized ? box.height * sourceSize.height : box.height;
  return {
    left: clamp((x / sourceSize.width) * 100),
    top: clamp((y / sourceSize.height) * 100),
    width: clamp((width / sourceSize.width) * 100),
    height: clamp((height / sourceSize.height) * 100),
  };
}

function polygonPoints(polygon: DetectionMaskPolygon, sourceSize: Size) {
  return polygon.points
    .map(([x, y]) => {
      const px = polygon.normalized ? x * sourceSize.width : x;
      const py = polygon.normalized ? y * sourceSize.height : y;
      return `${px},${py}`;
    })
    .join(" ");
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
