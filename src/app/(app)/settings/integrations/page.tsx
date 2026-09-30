import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, BarChart3, Clapperboard, ExternalLink, ImageIcon, Radar, Send, Sparkles } from "lucide-react";
import { Badge, Card, CardHeader, InlineAlert, PageHeader, type BadgeTone } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import { getIntegrationOverview } from "@/lib/integrations/registry";
import { INTEGRATION_STATE_LABELS, type IntegrationState } from "@/lib/integrations/resolver";
import { CAPABILITY_DESCRIPTIONS, CAPABILITY_LABELS, type Capability } from "@/lib/integrations/types";
import { formatDateTime } from "@/lib/time";
import { TestConnectionButton } from "./test-connection-button";

export const metadata: Metadata = { title: "Integrasi" };
export const dynamic = "force-dynamic";

const CAPABILITY_ICONS: Record<Capability, LucideIcon> = {
  ai_text: Sparkles,
  social_publish: Send,
  social_metrics: BarChart3,
  trend_source: Radar,
  video_render: Clapperboard,
  image_assist: ImageIcon,
};

const STATE_TONES: Record<IntegrationState, BadgeTone> = {
  active: "emerald",
  simulated: "violet",
  not_configured: "slate",
  disabled: "slate",
  error: "rose",
};

function StateBadge({ state }: { state: IntegrationState }) {
  return <Badge tone={STATE_TONES[state]}>{INTEGRATION_STATE_LABELS[state]}</Badge>;
}

export default async function IntegrationsPage() {
  await requireSession();
  const overview = await getIntegrationOverview();
  const { policy } = overview;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pengaturan"
        title="Integrasi"
        description="Slot API untuk fitur lanjutan. Tanpa kunci API, setiap fitur tetap punya jalur manual. Nilai env tidak pernah ditampilkan — hanya namanya."
        actions={
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden /> Kembali ke Pengaturan
          </Link>
        }
      />

      {policy.error ? (
        <InlineAlert tone="error" title="Konfigurasi simulasi ditolak">
          {policy.error}
        </InlineAlert>
      ) : policy.allowed ? (
        <InlineAlert tone="warning" title="Mode simulasi aktif">
          Provider tanpa kunci memakai hasil berlabel Simulasi. Simulasi tidak pernah menerbitkan konten dan tidak masuk Laporan produksi.
          Mode ini otomatis mati di Vercel/production.
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {overview.capabilities.map((cap) => {
          const Icon = CAPABILITY_ICONS[cap.capability];
          return (
            <Card key={cap.capability} className="flex flex-col gap-4 p-5" aria-labelledby={`cap-${cap.capability}`}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                  <Icon size={20} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`cap-${cap.capability}`} className="text-base font-bold text-ink">
                      {CAPABILITY_LABELS[cap.capability]}
                    </h2>
                    <StateBadge state={cap.state} />
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{CAPABILITY_DESCRIPTIONS[cap.capability]}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Kode kapabilitas <code className="rounded bg-canvas px-1 py-0.5">{cap.capability}</code>
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-line rounded-control border border-line">
                {cap.providers.map((p) => (
                  <li key={p.providerId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{p.label}</span>
                        <StateBadge state={p.state} />
                        {p.selected ? <Badge tone="blue">Dipakai</Badge> : null}
                      </div>
                      <p className="text-xs text-ink-soft">{p.message}</p>
                      {p.envKeys.length ? (
                        <p className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                          <span>Env:</span>
                          {p.envKeys.map((key) => (
                            <code
                              key={key}
                              className={
                                p.missingEnv.includes(key)
                                  ? "rounded bg-tone-rose-bg px-1 py-0.5 text-tone-rose-fg"
                                  : "rounded bg-tone-emerald-bg px-1 py-0.5 text-tone-emerald-fg"
                              }
                              title={p.missingEnv.includes(key) ? "Belum diisi" : "Sudah diisi"}
                            >
                              {key}
                              <span className="sr-only">{p.missingEnv.includes(key) ? " (belum diisi)" : " (sudah diisi)"}</span>
                            </code>
                          ))}
                        </p>
                      ) : (
                        <p className="text-xs text-ink-muted">Tidak membutuhkan env.</p>
                      )}
                      <p className="text-xs text-ink-muted">
                        Cek terakhir:{" "}
                        {p.lastCheck
                          ? `${formatDateTime(p.lastCheck.at)} — ${p.lastCheck.ok ? "berhasil" : "gagal"}`
                          : "belum pernah"}
                      </p>
                      {p.docsUrl ? (
                        <a
                          href={p.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          Dokumentasi provider <ExternalLink size={12} aria-hidden />
                        </a>
                      ) : null}
                    </div>
                    {p.canTest ? <TestConnectionButton providerId={p.providerId} label={p.label} /> : null}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <CardHeader
          title="Log integrasi terbaru"
          description="Panggilan provider dan uji koneksi. Pesan disensor dari token, kunci, dan data pribadi."
        />
        {overview.logsError ? (
          <InlineAlert tone="error" className="mt-4">
            Log tidak dapat dibaca: {overview.logsError}
          </InlineAlert>
        ) : overview.logs.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Belum ada panggilan integrasi. Jalankan &ldquo;Uji koneksi&rdquo; untuk mencatat pemeriksaan pertama.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-semibold">Waktu (WITA)</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Provider</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Operasi</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Hasil</th>
                  <th scope="col" className="py-2 font-semibold">Durasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-soft">{formatDateTime(log.createdAt)}</td>
                    <td className="py-2 pr-3">
                      <span className="font-medium text-ink">{log.providerId}</span>
                      {log.simulated ? <Badge tone="violet" className="ml-2">Simulasi</Badge> : null}
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">{log.operation}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={log.outcome === "success" ? "emerald" : "rose"}>
                        {log.outcome === "success" ? "Berhasil" : `Gagal${log.code ? ` (${log.code})` : ""}`}
                      </Badge>
                      {log.message ? <p className="mt-1 text-xs text-ink-muted">{log.message}</p> : null}
                    </td>
                    <td className="py-2 whitespace-nowrap text-ink-soft">{log.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
