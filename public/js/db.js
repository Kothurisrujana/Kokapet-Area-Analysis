// All Supabase access lives here (same functions the pages used with Firebase).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- reads (paged: Supabase returns at most 1000 rows per request) ----
async function readAll(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select("*").range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export async function fetchAll() {
  const [p, pl, ar] = await Promise.all([readAll("properties"), readAll("places"), readAll("areas")]);
  return {
    properties: p.map((r) => ({ id: r.id, ...r.data })),
    places: pl.map((r) => ({ id: r.id, ...r.data })),
    areas: ar.map((r) => ({ id: r.id, name: r.name, lastFile: r.last_file, updatedAt: r.updated_at })),
  };
}

// ---- writes: upsert on id → same row is updated, never duplicated ----
export async function upsertMany(table, rows, onProgress) {
  let done = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(({ id, ...data }) => {
      const row = { id, data, updated_at: new Date().toISOString() };
      if (table === "properties") row.area_id = data.areaId;
      return row;
    });
    const { error } = await sb.from(table).upsert(chunk, { onConflict: "id" });
    if (error) throw error;
    done += chunk.length;
    onProgress?.(done, rows.length);
  }
}

export async function saveArea(id, d) {
  const { error } = await sb.from("areas").upsert(
    { id, name: d.name, last_file: d.lastFile, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteArea(areaId) {
  const { count, error } = await sb.from("properties").delete({ count: "exact" }).eq("area_id", areaId);
  if (error) throw error;
  await sb.from("areas").delete().eq("id", areaId);
  return count ?? 0;
}
