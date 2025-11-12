## Retail Index Static Site

This repo now produces a multi-page static site that you can drop onto a Lightsail instance (or any static host). The key pieces are:

- `index.html` – dashboard homepage.
- `style.css` / `script.js` – shared styling + interactivity.
- `data.json` – the master dataset consumed at runtime.
- `scripts/generate-brand-pages.js` – build script that pre-renders every brand page.
- `dist/` – build output containing `index.html`, shared assets, and `brands/<slug>/index.html` for each brand (913 pages today).

### Generating the brand pages

1. Update `data.json` with the latest export.
2. Run `npm run build:brands` (Node 18+; no dependencies required).
3. Grab everything inside `dist/` – it is a complete site with one HTML file per brand plus the shared assets.

Each brand page is pre-populated with the same metrics shown in-app, so crawlers get real content even before JavaScript hydrates the charts.

### Deploying on Lightsail

1. Provision a Lightsail instance (Ubuntu + Nginx is fine) and point a subdomain such as `insights.example.com` at it.
2. Copy the `dist/` folder to `/var/www/html` (or your chosen doc root). The folder already includes `index.html`, `data.json`, `style.css`, `script.js`, and `brands/`.
3. Visit `https://insights.example.com/index.html` for the dashboard. Brand detail pages live at `https://insights.example.com/brands/<brand-slug>/` and are fully indexable.
4. When data changes, rerun `npm run build:brands` and redeploy the refreshed `dist/` folder.

### Updating the data

- Replace `data.json` at the project root.
- Rebuild (`npm run build:brands`).
- Sync `dist/` to your server.

Both the homepage and every brand page fetch the same `data.json` file at runtime, so you only need to keep that one file current.

### Local preview

- Run any static server from the `dist/` directory (`npx http-server dist`, `python3 -m http.server 4173 --directory dist`, etc.).
- Browse to `http://localhost:4173/index.html` for the homepage or `http://localhost:4173/brands/7-eleven/` for a detail page.

No Node/Express server is required in production—the Lightsail box only needs to serve the static files created during the build.
