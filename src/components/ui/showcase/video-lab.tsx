"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Download, Film, RotateCcw, ScanSearch } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, InlineAlert, SegmentedControl, Select, Spinner } from "@/components/ui";
import {
  GIF_SCALE_SMALL,
  detectVideoSupport,
  estimateSize,
  exportVideo,
  formatBytes,
  resolveContainer,
  type VideoContainer,
  type VideoExportFailure,
  type VideoExportOptions,
  type VideoExportProgress,
  type VideoExportSuccess,
  type VideoFps,
  type VideoSupportReport,
} from "@/lib/motion/export";
import { createSyntheticProvider, drawSyntheticFrame } from "@/lib/motion/export/synthetic";
import { compareLastFrame, type FrameDiff } from "@/lib/motion/export/verify";

/**
 * Lab Video internal (MT-16): menguji modul ekspor video memakai frame sintetis
 * deterministik, terlepas dari compositor motion. Tidak menyimpan apa pun ke server.
 */

type SizeKey = "1080x1080" | "1080x1350" | "1080x1920";
const SIZES: Record<SizeKey, { width: number; height: number; label: string }> = {
  "1080x1080": { width: 1080, height: 1080, label: "1:1" },
  "1080x1350": { width: 1080, height: 1350, label: "4:5" },
  "1080x1920": { width: 1080, height: 1920, label: "9:16" },
};
const DURATIONS = [2, 4, 10, 15] as const;
const PHASE_LABEL: Record<VideoExportProgress["phase"], string> = {
  preparing: "Menyiapkan encoder",
  encoding: "Mengencode frame",
  finalizing: "Menyusun berkas",
  done: "Selesai",
};

type RunState =
  | { status: "idle" }
  | { status: "running"; progress: VideoExportProgress | null }
  | { status: "success"; result: VideoExportSuccess; url: string }
  | { status: "error"; failure: VideoExportFailure };

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} dtk`;
}

export function VideoLab() {
  const [support, setSupport] = useState<VideoSupportReport | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [sizeKey, setSizeKey] = useState<SizeKey>("1080x1920");
  const [seconds, setSeconds] = useState<number>(4);
  const [fps, setFps] = useState<VideoFps>(30);
  const [container, setContainer] = useState<VideoContainer>("mp4");
  const [gifSmall, setGifSmall] = useState(true);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [diff, setDiff] = useState<{ status: "idle" | "running" | "done" | "error"; value?: FrameDiff; error?: string }>({
    status: "idle",
  });
  const [cancelNote, setCancelNote] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const size = SIZES[sizeKey];
  const options: VideoExportOptions = useMemo(
    () => ({
      width: size.width,
      height: size.height,
      fps,
      frameCount: seconds * fps,
      container,
      gifScale: container === "gif" && gifSmall ? GIF_SCALE_SMALL : undefined,
    }),
    [size, fps, seconds, container, gifSmall],
  );
  const estimate = useMemo(() => estimateSize(options), [options]);
  const resolution = support ? resolveContainer(container, support.containers) : null;

  useEffect(() => {
    let alive = true;
    detectVideoSupport()
      .then((report) => alive && setSupport(report))
      .catch((error: unknown) => alive && setSupportError(String(error)));
    return () => {
      alive = false;
    };
  }, []);

  // Pratinjau frame terakhir (statis; tidak ada animasi otomatis).
  useEffect(() => {
    const canvas = previewRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = size.width;
    canvas.height = size.height;
    drawSyntheticFrame(ctx, size.width, size.height, options.frameCount - 1, options.frameCount);
  }, [size, options.frameCount]);

  const releaseUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      releaseUrl();
    },
    [releaseUrl],
  );

  const start = useCallback(
    async (override?: VideoContainer) => {
      const target = override ?? container;
      if (override) setContainer(override);
      releaseUrl();
      setDiff({ status: "idle" });
      setCancelNote(false);
      const controller = new AbortController();
      abortRef.current = controller;
      setRun({ status: "running", progress: null });
      const opts: VideoExportOptions = {
        ...options,
        container: target,
        gifScale: target === "gif" && gifSmall ? GIF_SCALE_SMALL : undefined,
      };
      let provider;
      try {
        provider = createSyntheticProvider(opts.width, opts.height, opts.frameCount);
      } catch (error) {
        setRun({ status: "error", failure: { ok: false, code: "provider-error", message: String(error) } });
        return;
      }
      const result = await exportVideo(provider, opts, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!controller.signal.aborted) setRun({ status: "running", progress });
        },
      });
      if (abortRef.current === controller) abortRef.current = null;
      if (result.ok) {
        const url = URL.createObjectURL(result.blob);
        urlRef.current = url;
        setRun({ status: "success", result, url });
      } else {
        setRun(result.code === "aborted" ? { status: "idle" } : { status: "error", failure: result });
        if (result.code === "aborted") setCancelNote(true);
      }
    },
    [container, gifSmall, options, releaseUrl],
  );

  const verify = useCallback(async () => {
    if (run.status !== "success") return;
    const { result } = run;
    setDiff({ status: "running" });
    try {
      const reference = new OffscreenCanvas(result.width, result.height);
      const ctx = reference.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D tidak tersedia");
      // Frame sumber terakhir digambar di ukuran penuh lalu diskalakan seperti saat ekspor GIF.
      const full = new OffscreenCanvas(options.width, options.height);
      const fctx = full.getContext("2d");
      if (!fctx) throw new Error("Canvas 2D tidak tersedia");
      drawSyntheticFrame(fctx, options.width, options.height, options.frameCount - 1, options.frameCount);
      ctx.drawImage(full, 0, 0, result.width, result.height);
      const value = await compareLastFrame(result.blob, reference, result.width, result.height);
      setDiff({ status: "done", value });
    } catch (error) {
      setDiff({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }, [run, options]);

  const running = run.status === "running";
  const progress = run.status === "running" ? run.progress : null;
  const percent = progress && progress.total > 0 ? Math.round((progress.frame / progress.total) * 100) : 0;
  const fileName = `atala-lab-${sizeKey}-${seconds}s-${fps}fps.${run.status === "success" ? run.result.extension : container}`;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <div className="grid min-w-0 gap-5">
        <Card>
          <CardHeader
            title="Dukungan browser"
            description="Hasil VideoEncoder.isConfigSupported untuk ukuran Instagram. Urutan cadangan: MP4, WebM, lalu GIF."
          />
          {supportError ? (
            <InlineAlert tone="error" title="Deteksi gagal">
              {supportError}
            </InlineAlert>
          ) : !support ? (
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <Spinner size={16} label="Memeriksa dukungan" /> Memeriksa dukungan encoder…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm" data-testid="support-table">
                <thead className="text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Format</th>
                    <th className="py-2 pr-3 font-semibold">Codec</th>
                    {support.containers.mp4.sizes.length > 0
                      ? support.containers.mp4.sizes.map((s) => (
                          <th key={`${s.width}x${s.height}`} className="py-2 pr-3 font-semibold">
                            {s.width} × {s.height}
                          </th>
                        ))
                      : null}
                  </tr>
                </thead>
                <tbody>
                  {(["mp4", "webm", "gif"] as const).map((c) => {
                    const entry = support.containers[c];
                    return (
                      <tr key={c} className="border-t border-line" data-testid={`support-${c}`} data-supported={entry.supported}>
                        <td className="py-2 pr-3 font-semibold text-ink">{c.toUpperCase()}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-ink-soft">{entry.codec ?? "—"}</td>
                        {entry.sizes.map((s) => (
                          <td key={`${s.width}x${s.height}`} className="py-2 pr-3">
                            <Badge tone={s.supported ? "emerald" : "rose"}>
                              {s.supported ? (s.hardware ? "Ya, perangkat keras" : "Ya") : "Tidak"}
                            </Badge>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(["mp4", "webm", "gif"] as const)
                .filter((c) => support.containers[c].reason)
                .map((c) => (
                  <p key={c} className="mt-2 text-sm text-ink-soft">
                    <span className="font-semibold text-ink">{c.toUpperCase()}:</span> {support.containers[c].reason}
                  </p>
                ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Pengaturan ekspor" description="Frame sintetis deterministik: bentuk bergerak dan nomor frame." />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-1.5">
              <p className="text-sm font-semibold text-ink">Ukuran</p>
              <SegmentedControl
                label="Ukuran"
                value={sizeKey}
                onChange={setSizeKey}
                options={(Object.keys(SIZES) as SizeKey[]).map((key) => ({ value: key, label: SIZES[key].label }))}
              />
            </div>
            <div className="grid content-start gap-1.5">
              <p className="text-sm font-semibold text-ink">Format</p>
              <SegmentedControl
                label="Format"
                value={container}
                onChange={setContainer}
                options={[
                  { value: "mp4", label: "MP4" },
                  { value: "webm", label: "WebM" },
                  { value: "gif", label: "GIF" },
                ]}
              />
            </div>
            <Field label="Durasi" htmlFor="lab-duration">
              <Select id="lab-duration" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} disabled={running}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} detik
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Frame per detik" htmlFor="lab-fps">
              <Select id="lab-fps" value={fps} onChange={(e) => setFps(Number(e.target.value) === 60 ? 60 : 30)} disabled={running}>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </Select>
            </Field>
            {container === "gif" ? (
              <Field label="Skala GIF" htmlFor="lab-gif-scale" hint="GIF selalu 15 fps.">
                <Select
                  id="lab-gif-scale"
                  value={gifSmall ? "small" : "full"}
                  onChange={(e) => setGifSmall(e.target.value === "small")}
                  disabled={running}
                >
                  <option value="small">Lebar {GIF_SCALE_SMALL} px</option>
                  <option value="full">Ukuran penuh</option>
                </Select>
              </Field>
            ) : null}
          </div>

          <dl className="mt-4 grid gap-1 text-sm text-ink-soft">
            <div className="flex flex-wrap gap-x-2">
              <dt>Perkiraan ukuran maksimum:</dt>
              <dd className="font-semibold text-ink" data-testid="estimate">
                {formatBytes(estimate.bytes)}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt>Jumlah frame:</dt>
              <dd className="font-semibold text-ink">{options.frameCount}</dd>
            </div>
          </dl>
          {estimate.warning ? (
            <InlineAlert tone="warning" className="mt-3">
              {estimate.warning}
            </InlineAlert>
          ) : null}
          {resolution?.reason ? (
            <InlineAlert tone="warning" className="mt-3">
              {resolution.reason}
            </InlineAlert>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button icon={Film} onClick={() => start()} loading={running} data-testid="export-start">
              Ekspor {container.toUpperCase()}
            </Button>
            {running ? (
              <Button variant="secondary" icon={Ban} onClick={() => abortRef.current?.abort()} data-testid="export-cancel">
                Batal
              </Button>
            ) : null}
          </div>

          {running ? (
            <div className="mt-4" data-testid="export-progress">
              <div className="flex flex-wrap justify-between gap-2 text-sm text-ink-soft">
                <span>{progress ? PHASE_LABEL[progress.phase] : PHASE_LABEL.preparing}</span>
                <span className="tabular-nums" data-testid="export-progress-frames">
                  {progress ? `${progress.frame} / ${progress.total} frame` : "—"}
                  {progress?.etaMs != null ? ` · sisa ${formatSeconds(progress.etaMs)}` : ""}
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label="Progres ekspor"
              >
                <div className="h-full rounded-full bg-brand transition-[width] duration-150 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
              </div>
            </div>
          ) : null}

          {cancelNote && run.status === "idle" ? (
            <InlineAlert tone="info" className="mt-4">
              <span data-testid="export-cancelled">Ekspor dibatalkan. Tidak ada berkas yang dibuat.</span>
            </InlineAlert>
          ) : null}

          {run.status === "error" ? (
            <InlineAlert
              tone="error"
              title="Ekspor gagal"
              className="mt-4"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => start()} data-testid="export-retry">
                    Coba lagi
                  </Button>
                  {run.failure.fallback ? (
                    <Button size="sm" variant="secondary" onClick={() => start(run.failure.fallback)}>
                      Coba {run.failure.fallback.toUpperCase()}
                    </Button>
                  ) : null}
                </div>
              }
            >
              <span data-testid="export-error">{run.failure.message}</span>
            </InlineAlert>
          ) : null}
        </Card>

        {run.status === "success" ? (
          <Card
            data-testid="export-result"
            data-bytes={run.result.byteLength}
            data-elapsed-ms={run.result.elapsedMs}
            data-codec={run.result.codec}
          >
            <CardHeader
              title="Hasil ekspor"
              description={`${run.result.width} × ${run.result.height} · ${run.result.fps} fps · ${formatSeconds(run.result.durationMs)}`}
            />
            <dl className="grid gap-1 text-sm text-ink-soft sm:grid-cols-2">
              <div className="flex gap-2">
                <dt>Ukuran berkas:</dt>
                <dd className="font-semibold text-ink" data-testid="export-size">
                  {formatBytes(run.result.byteLength)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>Codec:</dt>
                <dd className="font-mono text-xs leading-5 text-ink">{run.result.codec}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Lama ekspor:</dt>
                <dd className="font-semibold text-ink">{formatSeconds(run.result.elapsedMs)}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Frame:</dt>
                <dd className="font-semibold text-ink">{run.result.frameCount}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={run.url}
                download={fileName}
                data-testid="export-download"
                className="inline-flex h-10 items-center gap-2 rounded-control bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Download size={18} aria-hidden="true" />
                Unduh {run.result.extension.toUpperCase()} ({formatBytes(run.result.byteLength)})
              </a>
              <Button variant="secondary" icon={ScanSearch} onClick={verify} loading={diff.status === "running"} data-testid="verify-last">
                Periksa frame terakhir
              </Button>
            </div>
            {diff.status === "done" && diff.value ? (
              <p
                className="mt-3 text-sm text-ink-soft"
                data-testid="verify-result"
                data-mean={diff.value.meanAbsDiff}
                data-ratio={diff.value.diffRatio}
                data-max={diff.value.maxDiff}
                data-ts={diff.value.decodedTimestamp ?? ""}
                data-frames={diff.value.decodedFrames ?? ""}
              >
                Selisih rata-rata {diff.value.meanAbsDiff.toFixed(2)} / 255 · piksel berbeda (&gt; {diff.value.threshold}){" "}
                {(diff.value.diffRatio * 100).toFixed(3)}% · selisih maks {diff.value.maxDiff}
              </p>
            ) : null}
            {diff.status === "error" ? (
              <InlineAlert tone="error" className="mt-3">
                <span data-testid="verify-error">{diff.error}</span>
              </InlineAlert>
            ) : null}
          </Card>
        ) : null}
      </div>

      <Card className="h-fit">
        <CardHeader title="Frame terakhir sumber" description="Acuan pembanding hasil decode." />
        <canvas
          ref={previewRef}
          className="mx-auto block h-auto max-h-[420px] w-auto max-w-full rounded-control border border-line"
          aria-label="Pratinjau frame terakhir"
        />
      </Card>
    </div>
  );
}
