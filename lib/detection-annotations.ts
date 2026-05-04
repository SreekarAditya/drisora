import { crackTypeLabel } from "@/lib/crack-labels";
import type { DetectionAnnotation, DetectionBox, DetectionMaskPolygon } from "@/types";

type RawObject = Record<string, unknown>;

export function parseDetectionAnnotations(raw: RawObject): DetectionAnnotation[] {
  const detections = firstArray(
    raw.detections,
    raw.final_detections,
    raw.yolo_detections,
    raw.predictions,
    raw.objects,
    raw.results,
  );
  const masks = firstArray(raw.sam2_masks, raw.masks, raw.segmentation_masks, raw.mask_polygons);

  return detections
    .map((value, index) => parseDetection(value, masks[index], index))
    .filter((value): value is DetectionAnnotation => value != null);
}

export function parseImageSize(raw: RawObject) {
  const frame = asObject(raw.frame);
  const image = asObject(raw.image);
  const width = numberFrom(raw.image_width) ?? numberFrom(raw.width) ?? numberFrom(frame?.width) ?? numberFrom(image?.width);
  const height = numberFrom(raw.image_height) ?? numberFrom(raw.height) ?? numberFrom(frame?.height) ?? numberFrom(image?.height);
  return { width: width ?? null, height: height ?? null };
}

function parseDetection(value: unknown, fallbackMask: unknown, index: number): DetectionAnnotation | null {
  const item = asObject(value);
  if (!item) return null;

  const box = parseBox(item);
  const polygons = [
    ...parsePolygons(item.mask_polygon),
    ...parsePolygons(item.mask_polygons),
    ...parsePolygons(item.polygon),
    ...parsePolygons(item.segmentation),
    ...parsePolygons(asObject(item.mask)?.polygon),
    ...parsePolygons(asObject(item.sam2_mask)?.polygon),
    ...parsePolygons(fallbackMask),
  ];

  if (!box && polygons.length === 0) return null;

  const rawLabel =
    stringFrom(item.class_name) ??
    stringFrom(item.label) ??
    stringFrom(item.name) ??
    stringFrom(item.crack_type) ??
    stringFrom(item.class) ??
    stringFrom(item.class_id) ??
    `Detection ${index + 1}`;

  return {
    id: stringFrom(item.id) ?? `${index}`,
    label: crackTypeLabel(rawLabel),
    confidence: numberFrom(item.confidence) ?? numberFrom(item.conf) ?? numberFrom(item.score),
    box,
    mask_polygons: polygons,
  };
}

function parseBox(item: RawObject): DetectionBox | null {
  const xyxy = firstNumberArray(item.bbox_xyxy, item.xyxy, item.box_xyxy);
  if (xyxy) return boxFromArray(xyxy, "xyxy");

  const xywh = firstNumberArray(item.bbox_xywh, item.xywh, item.box_xywh);
  if (xywh) return boxFromArray(xywh, "xywh");

  const bbox = firstNumberArray(item.bbox, item.box);
  if (bbox) return boxFromArray(bbox, "auto");

  const x = numberFrom(item.x) ?? numberFrom(item.left);
  const y = numberFrom(item.y) ?? numberFrom(item.top);
  const width = numberFrom(item.width) ?? numberFrom(item.w);
  const height = numberFrom(item.height) ?? numberFrom(item.h);
  if (x != null && y != null && width != null && height != null) {
    return normalizeBox({ x, y, width, height });
  }

  const x1 = numberFrom(item.x1);
  const y1 = numberFrom(item.y1);
  const x2 = numberFrom(item.x2) ?? numberFrom(item.right);
  const y2 = numberFrom(item.y2) ?? numberFrom(item.bottom);
  if (x1 != null && y1 != null && x2 != null && y2 != null) {
    return normalizeBox({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
  }

  return null;
}

function boxFromArray(values: number[], format: "xyxy" | "xywh" | "auto"): DetectionBox | null {
  if (values.length < 4) return null;
  const [a, b, c, d] = values;
  if (format === "xywh") return normalizeBox({ x: a, y: b, width: c, height: d });

  const xyxyBox = normalizeBox({ x: a, y: b, width: c - a, height: d - b });
  if (format === "xyxy") return xyxyBox;
  if (xyxyBox && xyxyBox.width > 0 && xyxyBox.height > 0) return xyxyBox;
  return normalizeBox({ x: a, y: b, width: c, height: d });
}

function normalizeBox(box: Omit<DetectionBox, "normalized">): DetectionBox | null {
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite)) return null;
  if (box.width <= 0 || box.height <= 0) return null;
  return {
    ...box,
    normalized: [box.x, box.y, box.width, box.height].every((value) => value >= 0 && value <= 1.5),
  };
}

function parsePolygons(value: unknown): DetectionMaskPolygon[] {
  if (value == null) return [];
  const flat = numberArray(value);
  if (flat && flat.length >= 6) {
    return [polygonFromFlat(flat)];
  }

  if (!Array.isArray(value)) return [];
  if (isPointArray(value)) {
    return [polygonFromPoints(value)];
  }

  return value.flatMap(parsePolygons);
}

function polygonFromFlat(values: number[]): DetectionMaskPolygon {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < values.length - 1; i += 2) {
    points.push([values[i], values[i + 1]]);
  }
  return { points, normalized: points.flat().every((point) => point >= 0 && point <= 1.5) };
}

function polygonFromPoints(values: unknown[]): DetectionMaskPolygon {
  const points = values
    .map((point) => Array.isArray(point) ? [numberFrom(point[0]), numberFrom(point[1])] : [null, null])
    .filter((point): point is [number, number] => point[0] != null && point[1] != null);
  return { points, normalized: points.flat().every((point) => point >= 0 && point <= 1.5) };
}

function isPointArray(value: unknown[]) {
  return value.length >= 3 && value.every((point) => Array.isArray(point) && point.length >= 2);
}

function firstArray(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function firstNumberArray(...values: unknown[]) {
  for (const value of values) {
    const numbers = numberArray(value);
    if (numbers && numbers.length >= 4) return numbers;
  }
  return null;
}

function numberArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const numbers = value.map(numberFrom);
  return numbers.every((number) => number != null) ? (numbers as number[]) : null;
}

function asObject(value: unknown): RawObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawObject : null;
}

function numberFrom(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function stringFrom(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
