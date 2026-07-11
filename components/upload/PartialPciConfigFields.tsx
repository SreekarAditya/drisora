"use client";

export type RoadClassOption = "" | "HIGHWAY" | "MDR_RURAL" | "URBAN";
export type SurfaceTypeOption = "" | "SD" | "OGPC" | "MSS" | "SDBC" | "BC";

export interface PartialPciConfigState {
  roadClass: RoadClassOption;
  surfaceType: SurfaceTypeOption;
  carriagewayWidthM: string;
  horizontalFovDeg: string;
  gsdRelativeErrorPct: string;
  calibrationSource: "" | "field_calibrated" | "manufacturer_spec" | "operator_estimate";
}

export const EMPTY_PARTIAL_PCI_CONFIG: PartialPciConfigState = {
  roadClass: "",
  surfaceType: "",
  carriagewayWidthM: "",
  horizontalFovDeg: "",
  gsdRelativeErrorPct: "",
  calibrationSource: "",
};

export function partialPciConfigIsValid(config: PartialPciConfigState) {
  const width = Number(config.carriagewayWidthM);
  const fov = Number(config.horizontalFovDeg);
  const error = Number(config.gsdRelativeErrorPct);
  return (
    config.roadClass !== "" &&
    (config.roadClass !== "MDR_RURAL" || config.surfaceType !== "") &&
    config.calibrationSource !== "" &&
    Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(fov) &&
    fov > 0 &&
    fov < 180 &&
    Number.isFinite(error) &&
    error > 0 &&
    error < 100
  );
}

export function partialPciOptions(config: PartialPciConfigState) {
  if (!partialPciConfigIsValid(config)) {
    throw new Error("Partial PCI configuration is incomplete");
  }
  return {
    road_class: config.roadClass,
    surface_type: config.roadClass === "MDR_RURAL" ? config.surfaceType : null,
    carriageway_width_m: Number(config.carriagewayWidthM),
    camera_horizontal_fov_deg: Number(config.horizontalFovDeg),
    gsd_relative_error_pct: Number(config.gsdRelativeErrorPct),
    camera_calibration_source: config.calibrationSource,
  };
}

export function PartialPciConfigFields({
  value,
  onChange,
}: {
  value: PartialPciConfigState;
  onChange: (next: PartialPciConfigState) => void;
}) {
  const fieldClass =
    "mt-1.5 w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#111116] px-3 py-2 text-sm text-[#F0F0F4] outline-none focus:border-[rgba(245,166,35,0.50)]";

  return (
    <div className="mt-5 rounded-[10px] border border-[rgba(245,166,35,0.22)] bg-[rgba(245,166,35,0.04)] p-4">
      <p className="text-sm font-medium text-[#F0F0F4]">Partial IRC:82-2023 section inputs</p>
      <p className="mt-1 text-xs leading-5 text-[#8A8A9A]">
        Drisora instruments cracking extent and pothole number only (28% of composite weight).
        It reports 100 m section bounds; roughness, ravelling, patching, and rut depth remain unmeasured.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-[#8A8A9A]">
          Road class
          <select
            value={value.roadClass}
            onChange={(event) =>
              onChange({
                ...value,
                roadClass: event.target.value as RoadClassOption,
                surfaceType: "",
              })
            }
            className={fieldClass}
            required
          >
            <option value="">Select road class</option>
            <option value="HIGHWAY">Highway (Expressway / NH / SH)</option>
            <option value="MDR_RURAL">MDR / rural road</option>
            <option value="URBAN">Urban road</option>
          </select>
        </label>

        {value.roadClass === "MDR_RURAL" ? (
          <label className="text-xs text-[#8A8A9A]">
            Surface type
            <select
              value={value.surfaceType}
              onChange={(event) =>
                onChange({ ...value, surfaceType: event.target.value as SurfaceTypeOption })
              }
              className={fieldClass}
              required
            >
              <option value="">Select surface type</option>
              <option value="SD">Surface Dressing (SD)</option>
              <option value="OGPC">Open Graded Premix Carpet (OGPC)</option>
              <option value="MSS">Mix Seal Surfacing (MSS)</option>
              <option value="SDBC">Semi Dense Bituminous Course (SDBC)</option>
              <option value="BC">Bituminous Concrete (BC)</option>
            </select>
          </label>
        ) : (
          <label className="text-xs text-[#8A8A9A]">
            Carriageway width (m)
            <input
              type="number"
              min="0.1"
              step="0.01"
              value={value.carriagewayWidthM}
              onChange={(event) => onChange({ ...value, carriagewayWidthM: event.target.value })}
              placeholder="e.g. 7.0"
              className={fieldClass}
              required
            />
          </label>
        )}

        {value.roadClass === "MDR_RURAL" && (
          <label className="text-xs text-[#8A8A9A]">
            Carriageway width (m)
            <input
              type="number"
              min="0.1"
              step="0.01"
              value={value.carriagewayWidthM}
              onChange={(event) => onChange({ ...value, carriagewayWidthM: event.target.value })}
              placeholder="e.g. 5.5"
              className={fieldClass}
              required
            />
          </label>
        )}

        <label className="text-xs text-[#8A8A9A]">
          Camera horizontal FOV (degrees)
          <input
            type="number"
            min="0.1"
            max="179.9"
            step="0.01"
            value={value.horizontalFovDeg}
            onChange={(event) => onChange({ ...value, horizontalFovDeg: event.target.value })}
            placeholder="From camera specification/calibration"
            className={fieldClass}
            required
          />
        </label>

        <label className="text-xs text-[#8A8A9A]">
          GSD uncertainty (%)
          <input
            type="number"
            min="0.1"
            max="99.9"
            step="0.1"
            value={value.gsdRelativeErrorPct}
            onChange={(event) => onChange({ ...value, gsdRelativeErrorPct: event.target.value })}
            placeholder="Required error bar"
            className={fieldClass}
            required
          />
        </label>

        <label className="text-xs text-[#8A8A9A] sm:col-span-2">
          Camera calibration source
          <select
            value={value.calibrationSource}
            onChange={(event) =>
              onChange({
                ...value,
                calibrationSource: event.target.value as PartialPciConfigState["calibrationSource"],
              })
            }
            className={fieldClass}
            required
          >
            <option value="">Select provenance</option>
            <option value="field_calibrated">Field calibrated</option>
            <option value="manufacturer_spec">Manufacturer specification (estimated GSD)</option>
            <option value="operator_estimate">Operator estimate (estimated GSD)</option>
          </select>
        </label>
      </div>

      <p className="mt-3 text-[11px] leading-4 text-[#6F6F7D]">
        GSD uses DJI SRT relative altitude (AGL), never absolute MSL altitude. Area uncertainty is
        propagated by squaring the GSD scale bounds. Nadir gimbal telemetry is required for spatial deduplication.
      </p>
    </div>
  );
}
