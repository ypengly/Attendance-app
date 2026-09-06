# 📸 Employee Attendance — Face Recognition Kiosk

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Made with JavaScript](https://img.shields.io/badge/Made%20with-JavaScript-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Face-API.js](https://img.shields.io/badge/Face--API.js-v0.22.2-FF6B6B.svg)](https://github.com/justadudewhohacks/face-api.js)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-4B32C3.svg)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![No Server Required](https://img.shields.io/badge/No%20Server-Required-00C853.svg)](#)

> **Zero-dependency, fully offline, privacy-first attendance kiosk powered by client-side face recognition.**

---

## ✨ Demo

> *🎥 Video demo coming soon — [watch the walkthrough](#)*

---

## 🚀 Features at a Glance

| Feature | Description |
|---------|-------------|
| 🔐 **No Login Required** | Employees walk up, look at the camera, and get automatically checked in/out |
| 🧠 **Real Face Recognition** | Powered by face-api.js with 68-point facial landmarks and 128-dimension embeddings |
| 📦 **Fully Local** | Everything runs in your browser — no server, no cloud, no data sharing |
| ⚡ **Instant Check-in/out** | Automatic recognition loop runs twice a second for real-time response |
| 💾 **Persistent Storage** | All data stored in IndexedDB — survives page refreshes and browser restarts |
| 🛡️ **Privacy First** | No video recorded — only numeric embeddings stored for matching |
| 📊 **Time Tracking** | Automatically calculates working hours between check-in and check-out |
| 🔄 **Smart Cooldown** | 30-second cooldown prevents duplicate registrations from a single visit |

---

## 📋 Table of Contents

- [✨ Demo](#-demo)
- [🚀 Features at a Glance](#-features-at-a-glance)
- [📋 Table of Contents](#-table-of-contents)
- [🎯 How It Works](#-how-it-works)
- [📦 Installation](#-installation)
- [🏃 Running the App](#-running-the-app)
- [📁 Project Structure](#-project-structure)
- [🛠️ Tech Stack](#️-tech-stack)
- [🔒 Privacy & Security](#-privacy--security)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)



### The Recognition Pipeline

1. **Enrollment**: Admin clicks **Enroll Employee**, enters ID/name, and the app captures four face samples milliseconds apart, averaging them into one robust embedding.

2. **Recognition**: The app grabs a frame twice a second, detects faces, computes embeddings, and compares against all enrolled employees using Euclidean distance (threshold: **0.5**).

3. **Attendance Logic**:
   - First recognition of the day = **Check-in**
   - Next recognition = **Check-out**
   - Working time calculated automatically
   - 30-second cooldown per employee prevents duplicate entries

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/face-recognition-kiosk.git

# Navigate to project directory
cd face-recognition-kiosk

# That's it! No dependencies to install 🎉
```

---

## 🏃 Running the App

> **⚠️ Important**: Browsers only allow camera access (`getUserMedia`) on `localhost` or `https` — never on a plain `file://` page.

From inside the project folder, run one of these commands:

### Option 1: Python (recommended)
```bash
python3 -m http.server 8080
```

### Option 2: Node.js
```bash
npx serve .
```

### Option 3: PHP
```bash
php -S localhost:8080
```

Then open **http://localhost:8080** in your browser and **allow camera access** when prompted.

---

## 📁 Project Structure

```
face-recognition-kiosk/
│
├── index.html              # Kiosk UI
├── css/
│   └── style.css           # Modern, responsive styling
├── js/
│   ├── app.js              # Core: camera, detection, attendance, enrollment
│   ├── db.js               # IndexedDB persistence layer
│   └── face-api.min.js     # Bundled face-api.js library
├── models/                 # Pre-trained face-api.js weights
│   ├── tiny_face_detector_model-weights_manifest.json
│   ├── tiny_face_detector_model-shard1
│   ├── face_landmark_68_model-weights_manifest.json
│   ├── face_landmark_68_model-shard1
│   ├── face_recognition_model-weights_manifest.json
│   └── face_recognition_model-shard1
└── README.md               # You are here!
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [face-api.js](https://github.com/justadudewhohacks/face-api.js) | Face detection, landmark detection, embedding generation |
| [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) | Local persistent storage for faces and attendance logs |
| [WebRTC / getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) | Camera access and video streaming |
| [Vanilla JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) | No frameworks — pure browser-native code |
| [HTML5 / CSS3](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5) | Responsive, modern UI |

---

## 🔒 Privacy & Security

| Aspect | Implementation |
|--------|----------------|
| **Video Storage** | ❌ No video ever recorded or saved |
| **Data Storage** | ✅ Only numeric embeddings (128 floats) stored |
| **Network Calls** | ✅ Zero — completely offline-capable |
| **Data Retention** | ✅ All data stored locally in your browser's IndexedDB |
| **GDPR Compliant** | ✅ By design — no personal data leaves the device |

> 🛡️ **Your employees' biometric data never leaves their browser. The app is fully self-contained and privacy-compliant by default.**

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Areas for Contribution
- 📱 Mobile-responsive improvements
- 🎨 UI/UX enhancements
- 🧪 Additional face recognition models
- 📊 Advanced analytics dashboard
- 🌐 Multi-language support
- 🔄 Export/Import data functionality

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🙏 Acknowledgments

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) — The amazing library that makes client-side face recognition possible
- [TensorFlow.js](https://www.tensorflow.org/js) — Powering the underlying machine learning models
- All open-source contributors who make projects like this possible

---

## 📞 Contact & Support


- **Email**: ypengly060@gmail.com

---

<p align="center">
  Made with ❤️ for privacy-first, offline-first attendance tracking
</p>

<p align="center">
  <sub>⭐ Star this repo if you found it useful! ⭐</sub>
</p>
