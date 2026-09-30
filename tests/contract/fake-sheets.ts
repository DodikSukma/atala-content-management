/**
 * Server Google Sheets API v4 palsu di memori untuk uji kontrak (F2-03).
 * Mendukung subset yang dipakai SheetsBackend: metadata tab, batchUpdate addSheet,
 * values.get / values.update / values.append dengan rentang A1 ber-tab.
 * Tidak ada panggilan jaringan; token disuntikkan lewat deps.getToken.
 */

type Cell = string | number;

interface Call {
  method: string;
  path: string;
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseRange(raw: string): { tab: string; sel?: string } {
  const m = /^'((?:[^']|'')+)'(?:!(.+))?$/.exec(raw);
  if (!m) throw new Error(`rentang tidak dikenal: ${raw}`);
  return { tab: m[1].replace(/''/g, "'"), sel: m[2] };
}

function parseSel(sel: string): { r1: number; c1: number; r2?: number; c2?: number } {
  const rowsOnly = /^(\d+):(\d+)$/.exec(sel);
  if (rowsOnly) return { r1: Number(rowsOnly[1]) - 1, c1: 0, r2: Number(rowsOnly[2]) - 1 };
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(sel);
  if (!m) throw new Error(`seleksi tidak dikenal: ${sel}`);
  return {
    r1: Number(m[2]) - 1,
    c1: colIndex(m[1]),
    r2: m[4] ? Number(m[4]) - 1 : undefined,
    c2: m[3] ? colIndex(m[3]) : undefined,
  };
}

function trimRow(row: Cell[]): Cell[] {
  const out = [...row];
  while (out.length && (out[out.length - 1] === "" || out[out.length - 1] === undefined)) out.pop();
  return out;
}

export interface FakeSheets {
  fetch: typeof fetch;
  getToken: () => Promise<string>;
  calls: Call[];
  tabs: Map<string, Cell[][]>;
  /** Status HTTP yang dikembalikan untuk n permintaan berikutnya (uji kegagalan). */
  failNext(status: number, times?: number): void;
}

export function createFakeSheets(): FakeSheets {
  const tabs = new Map<string, Cell[][]>();
  const calls: Call[] = [];
  const failures: number[] = [];

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  function grid(tab: string): Cell[][] {
    const g = tabs.get(tab);
    if (!g) throw Object.assign(new Error(`tab ${tab} tidak ada`), { status: 400 });
    return g;
  }

  async function handle(method: string, rest: string, body: unknown): Promise<Response> {
    if (rest === "" && method === "GET") {
      return json(200, { sheets: [...tabs.keys()].map((title) => ({ properties: { title } })) });
    }
    if (rest === ":batchUpdate" && method === "POST") {
      const requests = (body as { requests: { addSheet?: { properties: { title: string } } }[] }).requests;
      for (const r of requests) {
        const title = r.addSheet?.properties.title;
        if (!title) continue;
        if (tabs.has(title)) return json(400, { error: { status: "INVALID_ARGUMENT" } });
        tabs.set(title, []);
      }
      return json(200, {});
    }
    const valuesMatch = /^\/values\/(.+?)(:append)?$/.exec(rest);
    if (!valuesMatch) return json(404, { error: { status: "NOT_FOUND" } });
    const { tab, sel } = parseRange(decodeURIComponent(valuesMatch[1]));
    const g = grid(tab);

    if (valuesMatch[2] === ":append" && method === "POST") {
      const rows = (body as { values: Cell[][] }).values;
      let last = g.length;
      while (last > 0 && trimRow(g[last - 1] ?? []).length === 0) last -= 1;
      g.splice(last, 0, ...rows.map((r) => [...r]));
      return json(200, {});
    }
    if (method === "PUT") {
      const rows = (body as { values: Cell[][] }).values;
      const { r1, c1 } = parseSel(sel ?? "A1");
      rows.forEach((row, i) => {
        const target = (g[r1 + i] ??= []);
        row.forEach((cell, j) => {
          while (target.length < c1 + j) target.push("");
          target[c1 + j] = cell;
        });
      });
      for (let i = 0; i < g.length; i += 1) g[i] ??= [];
      return json(200, {});
    }
    if (method === "GET") {
      let rows: Cell[][] = g;
      if (sel) {
        const { r1, c1, r2, c2 } = parseSel(sel);
        rows = g.slice(r1, (r2 ?? r1) + 1).map((row) => row.slice(c1, c2 === undefined ? undefined : c2 + 1));
      }
      const values = rows.map(trimRow);
      while (values.length && values[values.length - 1].length === 0) values.pop();
      return json(200, values.length ? { values } : {});
    }
    return json(405, { error: { status: "METHOD_NOT_ALLOWED" } });
  }

  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const method = (init?.method ?? "GET").toUpperCase();
    const rest = url.pathname.replace(/^\/v4\/spreadsheets\/[^/:]+/, "");
    calls.push({ method, path: rest });
    const status = failures.shift();
    if (status) return json(status, { error: { status: "SIMULATED_FAILURE" } });
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      return await handle(method, rest, body);
    } catch (error) {
      const code = (error as { status?: number }).status ?? 500;
      return json(code, { error: { status: "FAKE_ERROR" } });
    }
  }) as typeof fetch;

  return {
    fetch: fakeFetch,
    getToken: async () => "token-uji",
    calls,
    tabs,
    failNext(status: number, times = 1) {
      for (let i = 0; i < times; i += 1) failures.push(status);
    },
  };
}
