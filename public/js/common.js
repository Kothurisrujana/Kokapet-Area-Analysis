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

// Budget classes for the area clusters, cheapest first
export const BUDGETS = {
  low:     { label: "Low-budget",  color: "#2e9e5b" },
  high:    { label: "High-budget", color: "#f59e0b" },
  premium: { label: "Premium",     color: "#8e24aa" },
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

const median = (a) => {
  const s = [...a].sort((x, y) => x - y), n = s.length;
  return !n ? null : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const stdev = (a) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1;
};

// k-means on location + price, started from far-apart points so the result never changes between page loads
function kmeans(pts, k) {
  const avg = (list, f) => list.reduce((a, p) => a + p[f], 0) / list.length;
  const mean = (list) => ({ x: avg(list, "x"), y: avg(list, "y"), z: avg(list, "z") });
  const mid = mean(pts);
  const centers = [pts.reduce((a, p) => (dist2(p, mid) > dist2(a, mid) ? p : a))];
  while (centers.length < k) {
    const away = (p) => Math.min(...centers.map((c) => dist2(p, c)));
    centers.push(pts.reduce((a, p) => (away(p) > away(a) ? p : a)));
  }
  let groups;
  for (let it = 0; it < 50; it++) {
    groups = centers.map(() => []);
    pts.forEach((p) => {
      const near = centers.reduce((b, c, i) => (dist2(p, c) < dist2(p, centers[b]) ? i : b), 0);
      groups[near].push(p);
    });
    groups.forEach((g, i) => { if (g.length) centers[i] = mean(g); });
  }
  return groups.map((g, i) => ({ center: centers[i], pts: g })).filter((g) => g.pts.length);
}

function convexHull(points) {
  const s = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list) => {
    const h = [];
    for (const p of list) {
      while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(s), ...half(s.reverse())];
}

// How much price counts against location when grouping projects (0 = location only)
const PRICE_WEIGHT = 1.5;

// Group one area's projects into zones of nearby, similarly priced projects, then give the
// cheapest third of zones, the middle third and the top third a budget label.
// Sets pj.budget and pj.zone on every project.
function buildZones(projects) {
  const cosLat = Math.cos((projects[0].lat * Math.PI) / 180);
  const known = projects.map((pj) => pj.avgPsf).filter(Boolean).sort((a, b) => a - b);
  // a few extreme prices are capped here so they can't take a whole zone for themselves
  const cap = (v) => Math.min(known[Math.floor(0.9 * (known.length - 1))], Math.max(known[Math.floor(0.1 * (known.length - 1))], v));
  const logPsf = (pj) => (known.length ? Math.log(cap(pj.avgPsf ?? median(known))) : 0);
  const xs = projects.map((pj) => pj.lng * cosLat), ys = projects.map((pj) => pj.lat);
  const geo = Math.hypot(stdev(xs), stdev(ys)), priceSd = known.length ? stdev(projects.map(logPsf)) : 1;
  const pts = projects.map((pj, i) => ({ x: xs[i] / geo, y: ys[i] / geo, z: (logPsf(pj) / priceSd) * PRICE_WEIGHT, pj }));
  // a multiple of 3 zones, so each budget label gets the same number of them
  const k = Math.min(pts.length, 3 * Math.max(1, Math.min(3, Math.round(Math.sqrt(pts.length) / 3))));
  const zones = kmeans(pts, k).map((g) => {
    const units = g.pts.flatMap((p) => p.pj.units);
    const psf = median(units.map((u) => u.psf).filter(Boolean));
    return { projects: g.pts.map((p) => p.pj), units, psf: psf && Math.round(psf), budget: null };
  });

  const priced = zones.filter((z) => z.psf).sort((a, b) => a.psf - b.psf);
  const keys = Object.keys(BUDGETS), n = priced.length;
  priced.forEach((z, i) => (z.budget = keys[n >= 3 ? Math.floor((i * 3) / n) : 3 - n + i]));
  // A project's own label uses the price gaps between the three groups of zones
  const firstOf = (b) => priced.findIndex((z) => z.budget === b);
  const cut = (b) => { const i = firstOf(b); return i > 0 ? (priced[i - 1].psf + priced[i].psf) / 2 : 0; };
  const cutHigh = cut("high"), cutPremium = cut("premium");

  // Each zone's outline wraps its projects with roughly 150 m of margin
  const m = 0.00135;
  const counts = {};
  zones.sort((a, b) => (a.psf ?? 0) - (b.psf ?? 0)).forEach((z) => {
    z.polygon = convexHull(z.projects.flatMap((pj) => [...Array(12).keys()].map((a) => ({
      x: pj.lng * cosLat + m * Math.cos((a * Math.PI) / 6), y: pj.lat + m * Math.sin((a * Math.PI) / 6) })))).map((p) => [p.y, p.x / cosLat]);
    const label = z.budget ? BUDGETS[z.budget].label : "Unpriced";
    counts[label] = (counts[label] || 0) + 1;
    z.name = `${label} ${counts[label]}`;
    z.projects.forEach((pj) => {
      pj.zone = z;
      pj.budget = !pj.avgPsf ? null : n < 3 ? z.budget : pj.avgPsf < cutHigh ? "low" : pj.avgPsf < cutPremium ? "high" : "premium";
    });
  });
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
  // zones are built per area so "Premium" means premium for that locality
  const byArea = {};
  projects.forEach((p) => (byArea[p.areaId] ||= []).push(p));
  Object.values(byArea).forEach(buildZones);
  for (const pj of projects) {
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
    const tier = pj.budget ? BUDGETS[pj.budget].label : "Unpriced";
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
