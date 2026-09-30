import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureStore } from "@/lib/data/fixture-store";
import { createSheetsStore } from "@/lib/data/sheets-store";
import { StorageError } from "@/lib/data/types";
import { createFakeSheets } from "./fake-sheets";
import { defineRepositoryContract } from "./repository-contract";

/** Suite kontrak yang sama untuk setiap adapter (F2-03). Postgres ditambahkan di F2-10. */

const FAKE_CREDENTIALS = JSON.stringify({ client_email: "uji@contoh.iam.gserviceaccount.com", private_key: "tidak-dipakai" });
let sheetCounter = 0;

defineRepositoryContract("fixture (berkas JSON lokal)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "atala-contract-"));
  return {
    store: createFixtureStore({ dir }),
    reopen: () => createFixtureStore({ dir }),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
});

defineRepositoryContract("Google Sheets (HTTP mock)", async () => {
  const fake = createFakeSheets();
  const sheetId = `sheet-kontrak-${(sheetCounter += 1)}`;
  const make = () => createSheetsStore(sheetId, FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
  return { store: make(), reopen: make };
});

describe("khusus Google Sheets (HTTP mock)", () => {
  it("membuat tab dan header berdasarkan nama saat pertama dipakai", async () => {
    const fake = createFakeSheets();
    const store = createSheetsStore("sheet-skema", FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
    await store.contents.list();
    expect([...fake.tabs.keys()].sort()).toEqual(["Assets", "Contents", "Designs", "Ideas", "IntegrationLogs", "Settings"]);
    expect(fake.tabs.get("Contents")![0]).toContain("id");
  });

  it("kegagalan API tidak pernah dilaporkan sebagai sukses", async () => {
    const fake = createFakeSheets();
    const store = createSheetsStore("sheet-gagal", FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
    await store.contents.list();
    fake.failNext(403);
    await expect(
      store.ideas.create({ title: "Ide", pillar: "Tips", hook: "", summary: "", sourceUrl: "", sourceCheckedAt: null, tags: [] }),
    ).rejects.toBeInstanceOf(StorageError);
    expect(await store.ideas.list()).toEqual([]);
  });

  it("header yang diurutkan ulang manual tetap terbaca benar", async () => {
    const fake = createFakeSheets();
    const make = () => createSheetsStore("sheet-urutan", FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
    const created = await make().ideas.create({ title: "Ide", pillar: "Tips", hook: "Hook", summary: "", sourceUrl: "", sourceCheckedAt: null, tags: ["a"] });
    const grid = fake.tabs.get("Ideas")!;
    const width = grid[0].length;
    const order = Array.from({ length: width }, (_, i) => width - 1 - i);
    for (let r = 0; r < grid.length; r += 1) {
      const row = Array.from({ length: width }, (_, i) => grid[r][i] ?? "");
      grid[r] = order.map((i) => row[i]);
    }
    expect(await make().ideas.get(created.id)).toEqual(created);
  });
});
