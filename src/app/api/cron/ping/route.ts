import { cronRejection, verifyCronRequest } from "@/lib/integrations/cron";

/**
 * Cron uji (F2-02): memastikan penjadwal (Vercel Cron) dapat menjangkau aplikasi
 * dengan CRON_SECRET yang benar. Route /api/cron/* tidak memakai sesi admin;
 * proteksinya adalah verifyCronRequest.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const check = verifyCronRequest(request.headers);
  if (!check.ok) return cronRejection(check);
  return Response.json({ ok: true, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
