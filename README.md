# ZTrack – Property Income & Tax Return Tracker

A web app for tracking rental property income and expenses across multiple clients and tax years, aligned to HMRC SA105.

---

## Features

- **Multi-client login** — Admin creates client accounts; each client sees only their own data
- **Tax year switching** — Separate data per tax year (2021/22 – 2025/26), addable per client
- **Tax Return Summary** — Full HMRC SA105-aligned breakdown per property
- **Property management** — Add/delete properties with monthly income & expense entry
- **Light theme** — Clean, professional UI with DM Serif Display + DM Sans fonts

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 3. Build for production

```bash
npm run build
```

Output goes to `dist/` — deploy to GitHub Pages, Netlify, Vercel, etc.

---

## Default Login

| Role  | Username | Password   |
|-------|----------|------------|
| Admin | `admin`  | `admin123` |

> ⚠️ **Change the admin password** before deploying. Open `src/App.jsx` and update:
> ```js
> const ADMIN_PASSWORD = "admin123";
> ```

---

## Adding Clients

1. Log in as admin
2. Click **⚙️ Clients** in the top nav
3. Enter the client's name, username, and password
4. Clients can then log in and see only their own properties

---

## Deploying to GitHub Pages

1. Install the GitHub Pages plugin:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Add to `package.json` scripts:
   ```json
   "homepage": "https://yourusername.github.io/ztrack",
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```

3. Add base path to `vite.config.js`:
   ```js
   base: "/ztrack/",
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

---

## Data Storage

All data is stored in the browser's `localStorage`. This means:
- Data persists between sessions on the same browser/device
- Data is **not** synced across devices
- For multi-device use, consider integrating a backend (Firebase, Supabase, etc.)

---

## Project Structure

```
ztrack/
├── public/
│   └── logo.png          # ZW logo
├── src/
│   ├── App.jsx           # Main application (all components)
│   ├── main.jsx          # React entry point
│   └── index.css         # Global styles
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## Tech Stack

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- Google Fonts: DM Serif Display + DM Sans
