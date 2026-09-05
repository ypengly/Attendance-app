/**
 * app.js — Employee Attendance kiosk logic.
 * Uses face-api.js (bundled locally, no CDN) for face detection,
 * landmarking and 128-d face descriptors, matched against embeddings
 * enrolled and stored locally in IndexedDB.
 */

const MODEL_URL = './models';
const MATCH_THRESHOLD = 0.5;      // lower = stricter match
const DETECT_INTERVAL_MS = 500;
const RESULT_HOLD_MS = 4500;      // how long a result banner stays up
const REPEAT_COOLDOWN_MS = 30000; // minimum gap before the same person can trigger a new state change
const ENROLL_SAMPLES_NEEDED = 4;
const ENROLL_SAMPLE_GAP_MS = 700;

const REQUIRED_MODEL_FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

// ---------- DOM ----------

const els = {
  clockDate: document.getElementById('clockDate'),
  clockTime: document.getElementById('clockTime'),
  video: document.getElementById('video'),
  overlay: document.getElementById('overlay'),
  cameraFrame: document.getElementById('cameraFrame'),
  cameraErrorMsg: document.getElementById('cameraErrorMsg'),
  modelsLoadingMsg: document.getElementById('modelsLoadingMsg'),
  modelErrorBanner: document.getElementById('modelErrorBanner'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusSub: document.getElementById('statusSub'),
  resultBanner: document.getElementById('resultBanner'),
  resultIcon: document.getElementById('resultIcon'),
  resultTitle: document.getElementById('resultTitle'),
  resultSubtitle: document.getElementById('resultSubtitle'),
  resultMeta: document.getElementById('resultMeta'),
  attendanceBody: document.getElementById('attendanceBody'),
  todayDateLabel: document.getElementById('todayDateLabel'),

  openEnrollBtn: document.getElementById('openEnrollBtn'),
  closeEnrollBtn: document.getElementById('closeEnrollBtn'),
  cancelEnrollBtn: document.getElementById('cancelEnrollBtn'),
  doneEnrollBtn: document.getElementById('doneEnrollBtn'),
  enrollBackdrop: document.getElementById('enrollBackdrop'),
  enrollFormView: document.getElementById('enrollFormView'),
  enrollSuccessView: document.getElementById('enrollSuccessView'),
  enrollSuccessDetail: document.getElementById('enrollSuccessDetail'),
  enrollId: document.getElementById('enrollId'),
  enrollName: document.getElementById('enrollName'),
  enrollVideo: document.getElementById('enrollVideo'),
  enrollOverlay: document.getElementById('enrollOverlay'),
  enrollProgress: document.getElementById('enrollProgress'),
  enrollStatus: document.getElementById('enrollStatus'),
  captureEnrollBtn: document.getElementById('captureEnrollBtn'),
};

// ---------- Utilities ----------

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTimeShort(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLong(d) {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

// ---------- Clock ----------

function tickClock() {
  const now = new Date();
  els.clockDate.textContent = formatDateLong(now);
  els.clockTime.textContent = formatTime(now);
}
setInterval(tickClock, 1000);
tickClock();
els.todayDateLabel.textContent = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });

// ---------- Model loading ----------

async function checkModelFilesPresent() {
  const missing = [];
  await Promise.all(REQUIRED_MODEL_FILES.map(async (file) => {
    try {
      const res = await fetch(`${MODEL_URL}/${file}`, { method: 'HEAD' });
      if (!res.ok) missing.push(file);
    } catch (e) {
      missing.push(file);
    }
  }));
  return missing;
}

async function loadModels() {
  const missing = await checkModelFilesPresent();
  if (missing.length > 0) {
    showModelError(missing);
    throw new Error('Missing model files: ' + missing.join(', '));
  }

  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
}

function showModelError(missingFiles) {
  els.modelErrorBanner.innerHTML =
    `<strong>Face-recognition models are not installed.</strong><br>` +
    `The following required file(s) are missing from <code>/models</code>:<br>` +
    missingFiles.map((f) => `<code>${f}</code>`).join(', ') +
    `<br>Add the face-api.js model weight files to the <code>/models</code> folder and reload this page.`;
  els.modelErrorBanner.classList.add('visible');
  els.modelsLoadingMsg.classList.remove('visible');
}

// ---------- Camera ----------

async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  });
  videoEl.srcObject = stream;
  await new Promise((resolve) => { videoEl.onloadedmetadata = resolve; });
  return stream;
}

// ---------- Face matcher (built from enrolled employees) ----------

let faceMatcher = null;
let employeesById = new Map();

async function rebuildFaceMatcher() {
  const employees = await AttendanceDB.getAllEmployees();
  employeesById = new Map(employees.map((e) => [e.employeeId, e]));

  if (employees.length === 0) {
    faceMatcher = null;
    return;
  }

  const labeled = employees.map((e) => new faceapi.LabeledFaceDescriptors(
    e.employeeId,
    [new Float32Array(e.descriptor)]
  ));
  faceMatcher = new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
}

// ---------- Attendance table ----------

async function renderAttendanceTable() {
  const records = await AttendanceDB.getRecordsForDate(todayKey());
  els.attendanceBody.innerHTML = '';

  if (records.length === 0) {
    els.attendanceBody.innerHTML = '<tr class="empty-row"><td colspan="4">No attendance recorded yet today.</td></tr>';
    return;
  }

  for (const r of records) {
    const tr = document.createElement('tr');
    if (r._justUpdated) tr.classList.add('row-new');

    const statusPill = r.status === 'completed'
      ? '<span class="pill completed">Completed</span>'
      : '<span class="pill inside">Inside</span>';

    tr.innerHTML = `
      <td data-label="Employee">${escapeHtml(r.name)}</td>
      <td data-label="Entry">${r.checkInDisplay}</td>
      <td data-label="Exit">${r.checkOutDisplay || '—'}</td>
      <td data-label="Status">${statusPill}</td>
    `;
    els.attendanceBody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Attendance recording logic ----------

const lastActionAt = new Map(); // employeeId -> timestamp of last recorded action

async function recordAttendance(employeeId) {
  const employee = employeesById.get(employeeId);
  if (!employee) return null;

  const now = new Date();
  const date = todayKey(now);
  const existing = await AttendanceDB.getTodayRecord(employeeId, date);

  if (!existing) {
    const record = {
      employeeId,
      name: employee.name,
      date,
      checkInTs: now.getTime(),
      checkInDisplay: formatTimeShort(now),
      checkOutTs: null,
      checkOutDisplay: null,
      workingMs: null,
      status: 'inside',
    };
    const saved = await AttendanceDB.createCheckIn(record);
    lastActionAt.set(employeeId, now.getTime());
    return { kind: 'checkin', employee, record: saved };
  }

  if (!existing.checkOutTs) {
    existing.checkOutTs = now.getTime();
    existing.checkOutDisplay = formatTimeShort(now);
    existing.workingMs = existing.checkOutTs - existing.checkInTs;
    existing.status = 'completed';
    await AttendanceDB.updateRecord(existing);
    lastActionAt.set(employeeId, now.getTime());
    return { kind: 'checkout', employee, record: existing };
  }

  // Already completed both check-in and check-out today.
  return { kind: 'already-done', employee, record: existing };
}

// ---------- Recognition state machine ----------

const STATE = { WAITING: 'waiting', DETECTED: 'detected', BUSY: 'busy' };
let currentState = STATE.WAITING;
let busyUntil = 0;

function setWaiting() {
  currentState = STATE.WAITING;
  els.statusDot.className = 'status-dot';
  els.statusDot.style.background = '';
  els.statusText.textContent = 'Looking for a face…';
  els.statusSub.textContent = '';
  els.resultBanner.classList.remove('visible', 'good', 'bad');
}

function setDetected() {
  if (currentState === STATE.DETECTED) return;
  currentState = STATE.DETECTED;
  els.statusDot.className = 'status-dot pulse';
  els.statusDot.style.background = 'var(--accent-active)';
  els.statusText.textContent = 'Face detected — verifying…';
  els.statusSub.textContent = '';
}

function showBanner({ good, title, subtitle, meta }) {
  els.resultBanner.classList.add('visible');
  els.resultBanner.classList.toggle('good', good);
  els.resultBanner.classList.toggle('bad', !good);
  els.resultIcon.textContent = good ? '✓' : '!';
  els.resultTitle.textContent = title;
  els.resultSubtitle.textContent = subtitle;
  els.resultMeta.innerHTML = meta || '';
}

async function handleUnknownFace() {
  if (Date.now() < busyUntil) return;
  currentState = STATE.BUSY;
  busyUntil = Date.now() + RESULT_HOLD_MS;

  els.statusDot.className = 'status-dot';
  els.statusDot.style.background = 'var(--accent-bad)';
  els.statusText.textContent = 'Face not recognized';
  els.statusSub.textContent = 'Please contact your administrator to enroll your face.';

  showBanner({
    good: false,
    title: 'Face not recognized',
    subtitle: 'Please contact your administrator to enroll your face.',
  });

  setTimeout(() => { if (Date.now() >= busyUntil) setWaiting(); }, RESULT_HOLD_MS);
}

async function handleRecognizedFace(employeeId) {
  if (Date.now() < busyUntil) return;

  const employee = employeesById.get(employeeId);
  if (!employee) return;

  const lastAt = lastActionAt.get(employeeId) || 0;
  const withinCooldown = Date.now() - lastAt < REPEAT_COOLDOWN_MS;

  currentState = STATE.BUSY;
  busyUntil = Date.now() + RESULT_HOLD_MS;

  els.statusDot.className = 'status-dot';
  els.statusDot.style.background = 'var(--accent-good)';
  els.statusText.textContent = `✓ ${employee.name}`;

  if (withinCooldown) {
    els.statusSub.textContent = 'Attendance already recorded recently.';
    showBanner({
      good: true,
      title: `Welcome, ${employee.name}`,
      subtitle: `Employee ID: ${employee.employeeId} — attendance already recorded.`,
    });
    setTimeout(() => { if (Date.now() >= busyUntil) setWaiting(); }, RESULT_HOLD_MS);
    return;
  }

  const result = await recordAttendance(employeeId);
  await renderAttendanceTable();

  if (result.kind === 'checkin') {
    els.statusSub.textContent = `Check-in recorded at ${result.record.checkInDisplay}`;
    showBanner({
      good: true,
      title: `Welcome, ${employee.name}`,
      subtitle: 'Attendance recorded',
      meta: `<span>Employee ID: <b>${employee.employeeId}</b></span><span>Entry time: <b>${result.record.checkInDisplay}</b></span>`,
    });
  } else if (result.kind === 'checkout') {
    els.statusSub.textContent = `Check-out recorded at ${result.record.checkOutDisplay}`;
    showBanner({
      good: true,
      title: `Goodbye, ${employee.name}`,
      subtitle: 'Check-out recorded',
      meta: `<span>Employee ID: <b>${employee.employeeId}</b></span><span>Exit time: <b>${result.record.checkOutDisplay}</b></span><span>Working time: <b>${formatDuration(result.record.workingMs)}</b></span>`,
    });
  } else {
    els.statusSub.textContent = 'Attendance already completed for today.';
    showBanner({
      good: true,
      title: `Hi, ${employee.name}`,
      subtitle: "You've already completed attendance for today.",
    });
  }

  setTimeout(() => { if (Date.now() >= busyUntil) setWaiting(); }, RESULT_HOLD_MS);
}

// ---------- Main detection loop ----------

function drawDetectionBox(canvas, video, detection, color) {
  const ctx = canvas.getContext('2d');
  const dims = { width: video.videoWidth, height: video.videoHeight };
  if (canvas.width !== dims.width || canvas.height !== dims.height) {
    canvas.width = dims.width;
    canvas.height = dims.height;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!detection) return;

  const box = detection.box || detection;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  const r = 14;
  const { x, y, width: w, height: h } = box;

  // Rounded-corner viewfinder frame rather than a plain rectangle.
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.stroke();
}

async function detectionTick() {
  if (!faceapi.nets.tinyFaceDetector.params) return; // models not loaded yet

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
  let detection = null;

  try {
    detection = await faceapi
      .detectSingleFace(els.video, options)
      .withFaceLandmarks()
      .withFaceDescriptor();
  } catch (e) {
    detection = null;
  }

  const busy = Date.now() < busyUntil;
  const boxColor = !detection ? '#5b6578' : (busy ? '#33cf8e' : '#e8a53d');

  drawDetectionBox(els.overlay, els.video, detection, boxColor);

  if (!detection) {
    if (!busy) setWaiting();
    return;
  }

  if (!busy) setDetected();
  if (busy) return; // still showing a result banner — don't process a new one yet

  if (!faceMatcher) {
    handleUnknownFace();
    return;
  }

  const match = faceMatcher.findBestMatch(detection.descriptor);
  if (match.label === 'unknown') {
    handleUnknownFace();
  } else {
    handleRecognizedFace(match.label);
  }
}

// ---------- Enrollment flow ----------

let enrollStream = null;
let enrollSamples = [];
let enrollCapturing = false;

function resetEnrollProgressDots() {
  els.enrollProgress.innerHTML = '';
  for (let i = 0; i < ENROLL_SAMPLES_NEEDED; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    els.enrollProgress.appendChild(dot);
  }
}

function updateEnrollProgressDots(activeIndex) {
  const dots = els.enrollProgress.querySelectorAll('.dot');
  dots.forEach((d, i) => {
    d.classList.toggle('done', i < enrollSamples.length);
    d.classList.toggle('active', i === activeIndex);
  });
}

function checkEnrollFormReady() {
  const ready = els.enrollId.value.trim() && els.enrollName.value.trim() && enrollStream && !enrollCapturing;
  els.captureEnrollBtn.disabled = !ready;
}

els.enrollId.addEventListener('input', checkEnrollFormReady);
els.enrollName.addEventListener('input', checkEnrollFormReady);

async function openEnrollModal() {
  els.enrollBackdrop.classList.add('visible');
  els.enrollFormView.style.display = '';
  els.enrollSuccessView.classList.remove('visible');
  els.enrollId.value = '';
  els.enrollName.value = '';
  els.enrollStatus.textContent = 'Enter details, then look at the camera.';
  enrollSamples = [];
  resetEnrollProgressDots();
  checkEnrollFormReady();

  try {
    enrollStream = await startCamera(els.enrollVideo);
    checkEnrollFormReady();
  } catch (e) {
    els.enrollStatus.textContent = 'Unable to access camera. Please allow camera permission.';
  }
}

function closeEnrollModal() {
  els.enrollBackdrop.classList.remove('visible');
  if (enrollStream) {
    enrollStream.getTracks().forEach((t) => t.stop());
    enrollStream = null;
  }
  enrollCapturing = false;
}

function averageDescriptors(descriptors) {
  const len = descriptors[0].length;
  const avg = new Float32Array(len);
  for (const d of descriptors) {
    for (let i = 0; i < len; i++) avg[i] += d[i];
  }
  for (let i = 0; i < len; i++) avg[i] /= descriptors.length;
  return avg;
}

async function runEnrollmentCapture() {
  const employeeId = els.enrollId.value.trim();
  const name = els.enrollName.value.trim();
  if (!employeeId || !name) return;

  const existing = await AttendanceDB.getEmployee(employeeId);
  if (existing) {
    els.enrollStatus.textContent = `Employee ID "${employeeId}" is already enrolled.`;
    return;
  }

  enrollCapturing = true;
  checkEnrollFormReady();
  enrollSamples = [];
  resetEnrollProgressDots();

  let firstPhoto = null;
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

  while (enrollSamples.length < ENROLL_SAMPLES_NEEDED) {
    updateEnrollProgressDots(enrollSamples.length);
    els.enrollStatus.textContent = `Hold still — sample ${enrollSamples.length + 1} of ${ENROLL_SAMPLES_NEEDED}`;

    let detection = null;
    try {
      detection = await faceapi
        .detectSingleFace(els.enrollVideo, options)
        .withFaceLandmarks()
        .withFaceDescriptor();
    } catch (e) {
      detection = null;
    }

    drawDetectionBox(els.enrollOverlay, els.enrollVideo, detection, detection ? '#33cf8e' : '#5b6578');

    if (!detection) {
      els.enrollStatus.textContent = 'No face detected. Please face the camera.';
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    if (!firstPhoto) {
      firstPhoto = capturePhotoDataUrl(els.enrollVideo);
    }

    enrollSamples.push(detection.descriptor);
    updateEnrollProgressDots(enrollSamples.length);
    await new Promise((r) => setTimeout(r, ENROLL_SAMPLE_GAP_MS));
  }

  const avgDescriptor = averageDescriptors(enrollSamples);

  await AttendanceDB.addEmployee({
    employeeId,
    name,
    descriptor: Array.from(avgDescriptor),
    photo: firstPhoto,
    enrolledAt: Date.now(),
  });

  await rebuildFaceMatcher();

  enrollCapturing = false;
  els.enrollFormView.style.display = 'none';
  els.enrollSuccessView.classList.add('visible');
  els.enrollSuccessDetail.textContent = `${name} (${employeeId}) can now use the attendance camera.`;
}

function capturePhotoDataUrl(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

els.openEnrollBtn.addEventListener('click', openEnrollModal);
els.closeEnrollBtn.addEventListener('click', closeEnrollModal);
els.cancelEnrollBtn.addEventListener('click', closeEnrollModal);
els.doneEnrollBtn.addEventListener('click', closeEnrollModal);
els.captureEnrollBtn.addEventListener('click', runEnrollmentCapture);
els.enrollBackdrop.addEventListener('click', (e) => {
  if (e.target === els.enrollBackdrop) closeEnrollModal();
});

// ---------- Boot ----------

async function boot() {
  setWaiting();
  await renderAttendanceTable();

  try {
    await startCamera(els.video);
  } catch (e) {
    els.cameraErrorMsg.classList.add('visible');
    els.modelsLoadingMsg.classList.remove('visible');
    return;
  }

  try {
    await loadModels();
  } catch (e) {
    console.error(e);
    return; // model error banner already shown
  }

  els.modelsLoadingMsg.classList.remove('visible');
  await rebuildFaceMatcher();

  setInterval(detectionTick, DETECT_INTERVAL_MS);
}

boot();
