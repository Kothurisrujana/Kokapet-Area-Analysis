# Hyderabad Property Map (Supabase)

- **/admin.html** – anyone can upload area spreadsheets (CSV/XLSX), which are saved to Supabase (Postgres). There is no sign-in, so anyone with the link can also change or delete data.
- **/** (the map) – always loads from Supabase. You never re-upload. Each area has its own tab, divided into Low-price, Medium-budget and High-price zones compared within that area.

Re-uploading merges: matching rows are **updated**, new rows are **added**, and exact duplicates are **skipped**.

## 1. Supabase (free, ~5 min)

1. Go to https://supabase.com, sign in as **kothurisrujana@gmail.com**, and click **New project**. Choose region **Mumbai (ap-south-1)** and set any DB password.
2. Go to **SQL Editor → New query**, paste all of `setup.sql`, and click **Run**. This creates the tables and the security rules.
3. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `public/js/supabase-config.js`.
   (The anon key is meant to be public. Never use the `service_role` key here.)

## 2. Put the site online (free)

Supabase stores the data, but it doesn't host websites. The easiest free host is **Netlify Drop**:

1. Open https://app.netlify.com/drop (a free account is needed to keep the site permanently).
2. Drag the **`public`** folder onto the page. You get a link like `https://kokapet-map.netlify.app`.
3. To update the site later, open Site → Deploys and drag the `public` folder again.

Vercel, GitHub Pages and Cloudflare Pages work the same way. Upload the `public` folder.

## Using it

1. Open `https://<your-site>/admin.html`.
2. Drop one or more area spreadsheets. The file name becomes the area name, and you can edit it.
3. Check the preview counts (new / update / duplicates / errors), then click **Upload to Supabase**.
4. Optional: upload `places_kokapet.csv` under **Place locations**. It gives the distance columns proper names and categories and adds pins for places that have lat/lng.

## Notes

- **Free tier:** 500 MB database (several hundred thousand listings), unlimited API reads.
- **Pausing:** free projects **pause after 7 days with no activity**. Click **Restore** in the dashboard to bring yours back. If the map is opened at least weekly, it stays awake.
- **SQL:** your data is Postgres, so you can query it directly, e.g.
  `select area_id, count(*) from properties group by area_id;`

## Files

| Path | Purpose |
|---|---|
| `public/index.html` | Map |
| `public/admin.html` | Upload |
| `public/js/supabase-config.js` | **Your Supabase URL + anon key** |
| `public/js/db.js` | All Supabase calls |
| `public/js/common.js` | Spreadsheet parsing, duplicate fingerprint, livability score |
| `setup.sql` | Tables + security rules (run once) |
| `places_kokapet.csv` | Names/categories of Kokapet places (6 with verified pins) |
