# Employee Attendance — Face Recognition Kiosk

A no-login, no-admin-panel attendance kiosk. Employees walk up, look at the
camera, and the app automatically checks them in or out using real face
recognition — everything runs and is stored locally in the browser.

## Running it

Browsers only allow camera access (`getUserMedia`) on `localhost` or `https`,
never on a plain `file://` page, so you need to serve the folder with a
simple local web server. From inside this folder, run one of:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then open **http://localhost:8080** (or whatever port/URL your server
prints) in a browser and allow camera access when prompted.

## How it works

- **Face recognition** is done entirely client-side with
  [face-api.js](https://github.com/justadudewhohacks/face-api.js), bundled
  locally in `js/face-api.min.js` — no CDN calls.
- **Models** live in `/models`. They're the standard face-api.js weights:
  a tiny face detector, a 68-point facial landmark model, and a
  128-dimension face recognition (embedding) model. If any file is
  missing, the app tells you exactly which file — it never silently
  falls back to a fake matcher.
- **Enrollment**: click **Enroll Employee**, enter an ID and name, and the
  app captures four face samples a few hundred milliseconds apart to
  average into one robust face embedding, then stores it locally.
- **Recognition loop**: roughly twice a second the app grabs a frame,
  detects a face, computes its embedding, and compares it against every
  enrolled employee's embedding (Euclidean distance, threshold 0.5). The
  closest match under the threshold is the recognized employee.
- **Attendance logic**: the first recognition of the day for an employee
  is a check-in; the next one is a check-out, with working time computed
  automatically. A 30-second cooldown per employee prevents a single
  visit from being recorded twice.
- **Storage**: everything (enrolled faces and today's attendance) is
  persisted in the browser's IndexedDB, so a page refresh never loses
  data. Nothing is sent to a server — this is a fully local, offline-
  capable app.
- **Privacy**: no video is recorded or saved. Only the numeric face
  embedding needed for matching is stored per employee.

## Folder structure

```
index.html            Kiosk UI
css/style.css          Styling
js/app.js              Camera, detection loop, attendance logic, enrollment
js/db.js               IndexedDB persistence layer
js/face-api.min.js     Bundled face-api.js library (no CDN)
models/                Bundled face-api.js model weight files (no CDN)
```
