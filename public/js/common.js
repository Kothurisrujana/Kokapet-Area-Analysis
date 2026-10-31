// Shared logic: spreadsheet row → property, place categories, locality profile.

export const CATS = {
  hospital:  { label: "Hospitals & Clinics",  icon: "🏥", color: "#e53935", w: 1.2 },
  school:    { label: "Schools",              icon: "🏫", color: "#1e88e5", w: 1.2 },
  college:   { label: "Colleges",             icon: "🎓", color: "#5e35b1", w: 0.4 },
  it:        { label: "IT & Commercial Hubs", icon: "🏢", color: "#00897b", w: 1.3 },
  shopping:  { label: "Shopping",             icon: "🛒", color: "#f4511e", w: 0.8 },
  park:      { label: "Parks & Lakes",        icon: "🌳", color: "#43a047", w: 0.8 },
  gym:       { label: "Gyms & Fitness",       icon: "💪", color: "#6d4c41", w: 0.4 },
  worship:   { label: "Places of Worship",    icon: "🛕", color: "#fb8c00", w: 0.3 },
  transport: { label: "Transport",            icon: "🚇", color: "#546e7a", w: 0.8 },
};

// Columns that describe the property itself (everything else numeric = a distance in km)
const CORE = new Set(["s.0", "s.no", "name of the project", "type", "bhk", "area_sqft", "no.of bathrooms",
  "floors", "floor no", "facing", "furnishing status", "status", "asking price", "price_numeric",
  "price per sqft", "lat-lon", "age_years", "total amenities", "area", "locality"]);

// keyword → category, for distance columns not listed in the places collection
const KEYWORDS = [
  ["hospital", /hospital|clinic|medi|dental|diagnost|ivf|fertility|ortho|eye|neuro|gyn|health|care/],
  ["college", /college|engineering|cbit|degree|junior|university|institute|iiit/],
  ["school", /school|grammar|pre-school|preschool|academy|oakridge|phoenix|global edge|sloka|ingenium/],
  ["it", /financial|district|tower|terminal|kokapet one|capital|neopolis|gar\b|wipro|tech|it park|sez|hitec|office/],
  ["shopping", /mall|mart|ratnadeep|market|super|store|dmart/],
  ["park", /park|lake|garden|ground|stadium|sagar/],
  ["gym", /gym|fitness|cult|transformation|kingdom/],
  ["worship", /temple|masjid|mosque|church|prayer|krishna|shiva|mandir|maissamma|gurudwara/],
  ["transport", /metro|orr|ring road|airport|bus|railway|station|connectivity/],
];

export const keyOf = (s) => String(s).trim().toLowerCase().replace(/[.\/#$\[\]]/g, "_").replace(/\s+/g, " ");
export const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleCase = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function guessCategory(key) {
  for (const [cat, re] of KEYWORDS) if (re.test(key)) return cat;
  return null;
}

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ₹]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const clean = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s.toLowerCase() === "nan" ? "" : s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase());
};

// "2.1 Cr" / "85 L" → rupees
function parsePrice(s) {
  const m = String(s ?? "").toLowerCase().match(/([\d.]+)\s*(cr|crore|l|lac|lakh)/);
  if (!m) return null;
  return parseFloat(m[1]) * (m[2].startsWith("c") ? 1e7 : 1e5);
}

// Stable fingerprint hash (pure JS, works on http, https and file://)
function cyrb53(str, seed) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
const sha1 = async (text) => cyrb53(text, 1) + cyrb53(text, 7);

// One spreadsheet row (keys already lower-cased) → Firestore document
export async function rowToProperty(raw, area) {
  const r = {};
  for (const [k, v] of Object.entries(raw)) r[String(k).trim().toLowerCase()] = v;
  const [lat, lng] = String(r["lat-lon"] ?? "").split(",").map((x) => parseFloat(x));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: "missing/invalid lat-lon" };
  const project = String(r["name of the project"] ?? "").trim();
  if (!project) return { error: "missing project name" };

  const price = num(r["price_numeric"]) ?? parsePrice(r["asking price"]);
  const areaSqft = num(r["area_sqft"]);
  const dist = {};
  for (const [k, v] of Object.entries(r)) {
    if (CORE.has(k)) continue;
    const n = num(v);
    if (n !== null) dist[keyOf(k)] = n;
  }
  const p = {
    area, areaId: slug(area), project, type: clean(r["type"]), bhk: num(r["bhk"]), areaSqft,
    baths: num(r["no.of bathrooms"]), floors: num(r["floors"]), floorNo: num(r["floor no"]),
    facing: clean(r["facing"]), furnishing: clean(r["furnishing status"]), status: clean(r["status"]),
    askingPrice: String(r["asking price"] ?? "").trim(), price,
    psf: num(r["price per sqft"]) ?? (price && areaSqft ? Math.round(price / areaSqft) : null),
    lat, lng, age: num(r["age_years"]), amenities: num(r["total amenities"]), dist,
  };
  // Fingerprint: the same flat uploaded twice gets the same id → merged, not duplicated
  // Every descriptive field except coordinates (some sheets drag-fill-increment the longitude per row)
  const fp = [p.areaId, slug(project), p.type, p.bhk, p.areaSqft, p.baths, p.floors, p.floorNo, p.facing,
    p.furnishing, p.status, p.askingPrice, p.price, p.psf, p.age].join("|").toLowerCase();
  p.id = await sha1(fp);
  return p;
}

// distance column → {name, cat}; places collection wins, else keyword guess
export function placeMeta(key, placesById) {
  const pl = placesById[key];
  if (pl) return { name: pl.name, cat: pl.category };
  if (key === "dist_financial_district_km") return { name: "Financial District", cat: "it" };
  return { name: titleCase(key), cat: guessCategory(key) };
}

export const inr = (v) => (!v ? "N/A" : v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : `₹${(v / 1e5).toFixed(1)} L`);
export const fmt = (v) => (v == null ? "-" : Number(v).toLocaleString("en-IN"));

function hav(a, b, c, d) {
  const p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

// Group properties into projects and compute the locality profile + livability score
export function buildProjects(properties, placesById) {
  const groups = new Map();
  for (const p of properties) {
    // one project = same area + same name (coordinates are averaged)
    const k = `${p.areaId}|${p.project.toLowerCase()}`;
    if (!groups.has(k)) groups.set(k, { name: p.project, area: p.area, areaId: p.areaId, units: [] });
    groups.get(k).units.push(p);
  }
  const projects = [...groups.values()];
  for (const pj of projects) {
    pj.lat = pj.units.reduce((a, u) => a + u.lat, 0) / pj.units.length;
    pj.lng = pj.units.reduce((a, u) => a + u.lng, 0) / pj.units.length;
  }
  for (const pj of projects) {
    const keys = new Set(pj.units.flatMap((u) => Object.keys(u.dist || {})));
    pj.dist = {};
    for (const k of keys) {
      const vals = pj.units.map((u) => u.dist?.[k]).filter((v) => v != null);
      if (vals.length) pj.dist[k] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    }
    const psfs = pj.units.map((u) => u.psf).filter(Boolean);
    pj.avgPsf = psfs.length ? Math.round(psfs.reduce((a, b) => a + b, 0) / psfs.length) : null;
    const prices = pj.units.map((u) => u.price).filter(Boolean);
    pj.range = prices.length ? `${inr(Math.min(...prices))} – ${inr(Math.max(...prices))}` : "N/A";
    pj.amen = Math.max(0, ...pj.units.map((u) => u.amenities || 0)) || null;
    pj.nearest = {}; pj.within = {};
    for (const [k, d] of Object.entries(pj.dist)) {
      const m = placeMeta(k, placesById);
      if (!m.cat) continue;
      if (!pj.nearest[m.cat] || d < pj.nearest[m.cat].d) pj.nearest[m.cat] = { name: m.name, d, key: k };
      pj.within[m.cat] = (pj.within[m.cat] || 0) + (d <= 2 ? 1 : 0);
    }
  }
  // per-area price tiers so "Luxury" means luxury for that locality
  const byArea = {};
  projects.forEach((p) => p.avgPsf && (byArea[p.areaId] ||= []).push(p.avgPsf));
  const q = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(f * (s.length - 1))]; };
  for (const pj of projects) {
    const arr = byArea[pj.areaId] || [0];
    const t1 = q(arr, 0.33), t2 = q(arr, 0.75);
    const scores = {};
    let sum = 0, wsum = 0;
    for (const [cat, c] of Object.entries(CATS)) {
      const n = pj.nearest[cat];
      if (!n) continue;
      // transport is naturally farther away → its own 0–15 km scale; others 0.5–6 km
      const s = cat === "transport" ? Math.max(0, Math.min(1, 1 - (n.d - 1) / 14))
                                    : Math.max(0, Math.min(1, 1 - (n.d - 0.5) / 5.5));
      // bonus (up to +10 pts) for having several options within 2 km
      const bonus = Math.min(0.1, Math.max(0, (pj.within[cat] || 0) - 1) * 0.025);
      scores[cat] = Math.min(1, s + bonus);
      sum += scores[cat] * c.w; wsum += c.w;
    }
    const livability = wsum ? Math.round((100 * sum) / wsum) : null;
    const tier = !pj.avgPsf ? "Unpriced" : pj.avgPsf >= t2 ? "Luxury" : pj.avgPsf >= t1 ? "Premium" : "Mid-segment";
    const villa = pj.units.filter((u) => /villa/i.test(u.type)).length / pj.units.length;
    const maxFloors = Math.max(0, ...pj.units.map((u) => u.floors || 0));
    const form = villa >= 0.5 ? "Villa community" : maxFloors >= 20 ? "High-rise gated community" : "Mid-rise residential";
    const uc = pj.units.filter((u) => /under/i.test(u.status)).length / pj.units.length;
    const tags = [];
    if (pj.nearest.it?.d <= 1.5) tags.push("IT / business corridor");
    if ((pj.within.hospital || 0) >= 3) tags.push("Healthcare-rich");
    if ((pj.within.school || 0) >= 3) tags.push("School hub");
    if (pj.nearest.park?.d <= 1) tags.push("Green / lakeside");
    tags.push(uc >= 0.5 ? "Emerging (mostly under construction)" : "Established (mostly ready)");
    const zone = tags.includes("IT / business corridor") ? "Business-district residential"
      : tags.includes("School hub") || tags.includes("Healthcare-rich") ? "Family residential" : "Peripheral / growth residential";
    const neighbours = projects.filter((o) => o !== pj && hav(pj.lat, pj.lng, o.lat, o.lng) <= 1).length;
    pj.profile = { type: `${tier} ${form}`, zone, tags, livability, neighbours,
      catScores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.round(v * 100)])) };
  }
  return projects;
}
