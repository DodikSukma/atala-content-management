"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PlugZap } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { testIntegrationAction } from "./actions";

export function TestConnectionButton({ providerId, label }: { providerId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const result = await testIntegrationAction(providerId);
      if (!result.ok) {
        toast({ tone: "error", title: "Uji koneksi tidak dapat dijalankan", description: result.error });
        return;
      }
      toast({
        tone: result.data.ok ? "success" : "error",
        title: result.data.ok ? `${label}: koneksi berhasil` : `${label}: koneksi gagal`,
        description: result.data.message,
      });
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="secondary" size="sm" icon={PlugZap} loading={pending} onClick={run} aria-label={`Uji koneksi ${label}`}>
      Uji koneksi
    </Button>
  );
}
