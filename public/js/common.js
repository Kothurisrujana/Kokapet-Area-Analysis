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

// Price levels for the area zones, cheapest first
export const LEVELS = {
  low:    { label: "Low-price",     color: "#1f8a50" },
  medium: { label: "Medium-budget", color: "#c98a00" },
  high:   { label: "High-price",    color: "#c5302b" },
};

// Point-to-line distance in km, for the Outer Ring Road stretch past Manchirevula
function kmFromOrr(lat, lng) {
  const kmX = 111.32 * Math.cos((lat * Math.PI) / 180), kmY = 110.57;
  const a = { x: 78.3529966 * kmX, y: 17.4030921 * kmY }, b = { x: 78.3561653 * kmX, y: 17.3570166 * kmY }, p = { x: lng * kmX, y: lat * kmY };
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

const kmBetween = (a, b, c, d) => Math.hypot((b - d) * 111.32 * Math.cos((a * Math.PI) / 180), (a - c) * 110.57);

// Named clusters per area. An area listed here uses these instead of the three price levels.
const AREA_CLUSTERS = {
  kokapet: {
    levels: {
      1: { label: "The Ultra-Premium Neopolis & Inner Core Cluster", color: "#2a78d6",
        desc: "Apartment towers in northern Kokapet, including the Neopolis side.",
        why: "Being closer to the Financial District, and tall new towers, may be pushing prices up." },
      2: { label: "The Golden Mile & Main Road Commercial Hub", color: "#eb6834",
        desc: "Apartments on the eastern side, along Golden Mile Road.",
        why: "Main-road access helps, but many lower-rise buildings may be holding prices down." },
      3: { label: "The Scenic Lake-Adjacent & Gated Villa Cluster", color: "#1baf7a",
        desc: "Gated villa communities across Kokapet.",
        why: "Villas are the main reason prices are high. The lake's own effect can't be measured, because the sheet's lake distances aren't reliable." },
      4: { label: "The Outer Peripheral & Value-Focused Hub", color: "#eda100",
        desc: "Apartments in the western and central parts, away from Golden Mile Road.",
        why: "Being away from the main road may keep many prices lower, while a few pricier towers make the cluster mixed." },
    },
    assign: (p) => (p.villa ? "3" : p.lat >= 17.4 ? "1" : p.lng >= 78.335 ? "2" : "4"),
  },
  manchirevula: {
    levels: {
      MC1: { label: "ORR Exit 18A", color: "#2a78d6",
        desc: "Apartments within 600 m of the Outer Ring Road, on the Narsingi exit side.",
        why: "Road access helps, but many listings here are unfinished Rajapushpa Infina towers, and some are well below the builder's price." },
      MC2: { label: "Green Valley", color: "#eb6834",
        desc: "Apartments in the north-west, towards Golden Mile Road. Green Valley isn't marked on public maps, so this boundary is a best fit.",
        why: "Being closer to Golden Mile Road and taller towers may be pushing prices up." },
      MC3: { label: "Dews Ville / Villa", color: "#1baf7a",
        desc: "All villa communities, plus homes within 1 km of Dews Ville.",
        why: "Large villas in gated communities are the main reason prices are high." },
      MC4: { label: "Old Village", color: "#eda100",
        desc: "Apartments around the old Manchirevula village in the south, plus unnamed apartments with only a general location.",
        why: "Smaller, lower-rise buildings may be keeping prices down." },
    },
    assign: (p) => {
      if (p.villa || kmBetween(p.lat, p.lng, 17.3749342, 78.3676816) <= 1) return "MC3";
      if (p.leftOut) return "MC4";
      if (kmFromOrr(p.lat, p.lng) <= 0.6) return "MC1";
      return p.lat < 17.378 ? "MC4" : "MC2";
    },
  },
};
export const levelsFor = (areaId) => AREA_CLUSTERS[areaId]?.levels ?? LEVELS;

// Which clusters to point people to, cheapest or priciest first
export const CLUSTER_GUIDE = {
  kokapet: { budget: ["2", "4"], premium: ["3", "1"], extra: "Prices overlap, so each cluster also has some cheaper and some pricier homes." },
  manchirevula: { budget: ["MC4", "MC1"], premium: ["MC3", "MC2"], extra: "Prices overlap, so each cluster also has some cheaper and some pricier homes. MC1 homes can cost a lot in total because many are large, but they are lower priced for their size." },
};

// What homes cost in a group of listings, and how its prices compare with the rest of the area.
// The comparison uses price per sqft so bigger homes don't look pricier just for being bigger:
// it's how often a listing here beats a listing elsewhere in the area.
export function priceStory(units, others) {
  const cost = units.map((u) => u.price).filter(Boolean).sort((a, b) => a - b);
  const at = (f) => { const i = f * (cost.length - 1), lo = Math.floor(i); return cost[lo] + (cost[Math.ceil(i)] - cost[lo]) * (i - lo); };
  const a = units.map((u) => u.psf).filter(Boolean), b = others.map((u) => u.psf).filter(Boolean);
  let wins = 0;
  a.forEach((x) => b.forEach((y) => { wins += x > y ? 1 : x === y ? 0.5 : 0; }));
  const share = a.length && b.length ? wins / (a.length * b.length) : 0.5;
  return { low: cost[0], high: cost[cost.length - 1], mostLow: at(0.25), mostHigh: at(0.75),
    trend: share >= 0.6 ? "Higher" : share <= 0.4 ? "Lower" : "Varying" };
}

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

// Keep the part of a polygon closer to site a than to site b. Each vertex's `by` remembers which
// neighbouring site (index j) made the edge that starts there, so neighbours can be found afterwards.
function clipCloser(poly, a, b, j) {
  const d2 = (p, c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
  const side = (p) => d2(p, b) - d2(p, a), out = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y), by: sp >= 0 ? j : p.by });
    }
  });
  return out;
}

// Listings that would mislead the zones. They stay on the map but don't shape or label any zone.
const NOT_IN_ZONES = {
  kokapet: [{ project: "sriram river view", why: "Its one listing shows ₹2,499/sqft, far below this project's other asking prices, so it looks like a data error." }],
  manchirevula: [{ at: [17.3736, 78.3489], counted: true, why: "These listings have no project name and only a general location for the area." }],
};
const leftOutRule = (pj) => (NOT_IN_ZONES[pj.areaId] || []).find((r) => (r.project ? r.project === pj.name.toLowerCase()
  : r.at[0] === +pj.lat.toFixed(4) && r.at[1] === +pj.lng.toFixed(4)));

// Divide one area into zones. Each project location takes the land nearest to it, and touching land in
// the same group joins into one zone, so zones never overlap. The group is the area's named cluster, or
// otherwise its price level: the cheapest third of locations are low, the middle third medium, the top high.
function buildZones(projects) {
  const areaName = projects[0].area, defs = AREA_CLUSTERS[projects[0].areaId];
  const kmX = 111.32 * Math.cos((projects[0].lat * Math.PI) / 180), kmY = 110.57;
  const toLatLng = (p) => [+(p.y / kmY).toFixed(6), +(p.x / kmX).toFixed(6)];
  projects.forEach((pj) => {
    pj.medianPsf = median(pj.units.map((u) => u.psf).filter(Boolean));
    const rule = leftOutRule(pj);
    pj.leftOut = rule?.why ?? null; pj.level = null; pj.zone = null;
    pj.villa = pj.units.filter((u) => /villa/i.test(u.type)).length > pj.units.length / 2;
    pj.maxFloors = Math.max(0, ...pj.units.map((u) => u.floors || 0));
    pj.ready = pj.units.filter((u) => /ready/i.test(u.status)).length > pj.units.length / 2;
    // named clusters still count listings with only a general location; a suspect price stays out
    if (defs && pj.medianPsf && (!rule || rule.counted)) pj.level = defs.assign(pj);
  });
  const byPlace = new Map();
  projects.filter((pj) => !pj.leftOut && pj.medianPsf).forEach((pj) => {
    const k = `${pj.lat.toFixed(4)},${pj.lng.toFixed(4)}`;
    if (!byPlace.has(k)) byPlace.set(k, []);
    byPlace.get(k).push(pj);
  });
  const sites = [...byPlace.values()].map((pjs) => ({
    pjs,
    x: (pjs.reduce((a, p) => a + p.lng, 0) / pjs.length) * kmX,
    y: (pjs.reduce((a, p) => a + p.lat, 0) / pjs.length) * kmY,
    psf: median(pjs.flatMap((p) => p.units.map((u) => u.psf).filter(Boolean))),
  }));
  if (!sites.length) return;

  const known = sites.map((s) => s.psf).sort((a, b) => a - b);
  // whole rupees, so the price key never shows decimals
  const cuts = [Math.floor(known[Math.floor(known.length / 3)]), Math.floor(known[Math.floor((2 * known.length) / 3)])];
  sites.forEach((s) => (s.level = defs ? s.pjs.reduce((a, p) => (p.units.length > a.units.length ? p : a)).level
    : s.psf < cuts[0] ? "low" : s.psf < cuts[1] ? "medium" : "high"));

  // The area outline wraps every project location with about 350 m of margin
  const margin = 0.35;
  const outline = convexHull(sites.flatMap((s) => [...Array(24).keys()].map((a) => ({
    x: s.x + margin * Math.cos((a * Math.PI) / 12), y: s.y + margin * Math.sin((a * Math.PI) / 12), by: null }))));
  sites.forEach((s, i) => {
    s.cell = sites.reduce((poly, o, j) => (j === i ? poly : clipCloser(poly, s, o, j)), outline);
    s.touches = new Set(s.cell.map((v) => v.by).filter((j) => j != null));
  });

  // Touching locations at the same level become one zone
  const zoneOf = new Array(sites.length).fill(-1), groups = [];
  sites.forEach((s, start) => {
    if (zoneOf[start] >= 0) return;
    const members = [], todo = [start];
    zoneOf[start] = groups.length;
    while (todo.length) {
      const i = todo.pop();
      members.push(i);
      sites.forEach((o, j) => {
        if (zoneOf[j] < 0 && o.level === s.level && (sites[i].touches.has(j) || o.touches.has(i))) { zoneOf[j] = groups.length; todo.push(j); }
      });
    }
    groups.push(members);
  });

  const area = (c) => Math.abs(c.reduce((a, p, i) => { const q = c[(i + 1) % c.length]; return a + p.x * q.y - q.x * p.y; }, 0)) / 2;
  const zones = groups.map((members, g) => {
    const list = members.map((i) => sites[i]);
    const pjs = list.flatMap((s) => s.pjs), units = pjs.flatMap((p) => p.units);
    const edges = [];
    members.forEach((i) => sites[i].cell.forEach((v, n, c) => {
      if (v.by == null || zoneOf[v.by] !== g) edges.push([toLatLng(v), toLatLng(c[(n + 1) % c.length])]);
    }));
    const big = list.reduce((a, s) => (area(s.cell) > area(a.cell) ? s : a)).cell;
    const mid = { x: big.reduce((a, p) => a + p.x, 0) / big.length, y: big.reduce((a, p) => a + p.y, 0) / big.length };
    return { level: list[0].level, area: areaName, cuts: defs ? null : cuts, projects: pjs, units, edges, label: toLatLng(mid),
      polygon: list.map((s) => s.cell.map(toLatLng)), psf: Math.round(median(units.map((u) => u.psf).filter(Boolean))) };
  });
  Object.keys(levelsFor(projects[0].areaId)).forEach((level) => {
    zones.filter((z) => z.level === level).sort((a, b) => a.psf - b.psf).forEach((z, i) => {
      z.id = defs ? level : `${level[0].toUpperCase()}${i + 1}`;
      z.projects.forEach((pj) => { pj.zone = z; pj.level = defs ? pj.level : level; });
    });
  });
}

// Group properties into projects and compute the locality profile + livability score
export function buildProjects(properties, placesById) {
  const groups = new Map();
  for (const p of properties) {
    // one project = same area + same name (coordinates are averaged); unnamed listings stay at their own spot
    const spot = /unnamed/i.test(p.project) ? `|${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : "";
    const k = `${p.areaId}|${p.project.toLowerCase()}${spot}`;
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
  // zones are built per area so "High-price" means high for that locality
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
    const tier = AREA_CLUSTERS[pj.areaId] ? "" : pj.level ? `${LEVELS[pj.level].label} ` : "Unclassified ";
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
    pj.profile = { type: `${tier}${form}`, zone, tags, livability, neighbours,
      catScores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.round(v * 100)])) };
  }
  return projects;
}
