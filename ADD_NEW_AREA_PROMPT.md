# Prompt: add a new area to the property map

Copy everything below the line, fill in the brackets, and attach your reference file.

---

You are working on my Hyderabad property map, in this repository: https://github.com/Kothurisrujana/Kokapet-Area-Analysis
It is live at https://hyderabad-area-analysis.vercel.app. It is a static site in the `public` folder, hosted on Vercel, with data in Supabase. Pushing to `main` updates the live site. Kokapet and Manchirevula are already on it.

Add a new area: **[AREA NAME]**. My reference file is **[FILE PATH]**.

**Step 1: Build the dataset**

Create `[AREA]_Property_FMV.csv` in the same format as the existing areas. The columns are:
`s.0, name of the project, type, bhk, area_sqft, no.of bathrooms, floors, floor no, facing, furnishing status, status, asking price, price_numeric, price per sqft, lat-lon, age_years , orr connectivity, airport distance, total amenities`, followed by one column per nearby place, holding the distance in km.

Follow these rules:
- `lat-lon` and the project name are required, or the row is rejected.
- Any other numeric column is treated as a distance. Don't add columns like units, towers, acres or year. Put them in a separate notes workbook.
- Write `asking price` as text, like `2.1 Cr` or `85 L`. Write `price_numeric` in rupees.
- Use `Ready to Move` or `Under Construction` for status.
- Name the file `[AREA]_Property_FMV.csv`, because the site takes the area name from the file name.
- Use only 2025 and 2026 prices unless I say otherwise. Keep older prices in the notes workbook.

Treat the data honestly:
- Never invent values. Leave a field blank if it can't be verified.
- Find project locations from reliable public sources, and check that each result is the same project in this area.
- If a project can't be located, use a general area point and flag it.
- Stop if a site blocks access or asks for a CAPTCHA. Don't try to get around it.
- Use my distances where my file has them. Otherwise calculate straight-line distances from OpenStreetMap locations, and say so.
- Also create `places_[area].csv` with the columns `column, name, category, lat, lng, source`. Categories are hospital, school, college, it, shopping, park, gym, worship and transport.
- Put sources, flagged prices, removed rows and corrected names in `[AREA]_Data_Notes.xlsx`.

**Step 2: Test before uploading**

Run the CSV through `rowToProperty` and `buildProjects` in `public/js/common.js`. Report the rows parsed, the errors and the zones created. Don't write to my live database without asking.

**Step 3: Add the clusters**

My clusters for this area are: **[CLUSTER NAMES, or "use Low-price, Medium-budget and High-price"]**.

If I give names, add them to `AREA_CLUSTERS` and `CLUSTER_GUIDE` in `public/js/common.js`, using the existing areas as the pattern. Each cluster needs a written rule, a description and likely price influences. Add projects with only a general location to `NOT_IN_ZONES`, so they don't shape the map. Tell me which rules are your judgement.

**Step 4: Check and publish**

Test locally with `python -m http.server 8013 --directory public`. Show me the results, and ask before you commit or push. After I upload the files and you push, check the live site.

**How to report back**

Use simple language. Tell me what you checked, what you couldn't check, and which values need my review. Show actual costs, and don't use median or average prices.
