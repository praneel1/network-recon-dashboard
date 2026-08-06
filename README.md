# 📡 NetRecon - Network Reconnaissance Dashboard

NetRecon is a high-performance, lightweight network reconnaissance & telemetry dashboard built with Python (Flask) and a modern Glassmorphism Single Page Interface.

It integrates all custom network scanning, device discovery, port scanning, service detection, and hardware telemetry modules seamlessly without blocking the web UI thread.

---

## ⚡ Features & Capabilities

- **🚀 Instant Load Times (< 20ms)**: Built with lightweight Flask & Vanilla JS so the UI remains ultra-fast and responsive.
- **⚡ Asynchronous Non-Blocking Scans**: Long-running scans (ARP scan, ping sweeps, top-1000 port scans, nmap versioning) execute in background threads while live progress is polled in real-time.
- **📊 Real-time System Telemetry**: CPU load gauges, RAM memory allocation, storage disk utilization, system uptime, and processor specifications.
- **🌐 Network & Gateway Inspection**: Active interface auto-detection, local IPv4/v6 addresses, MAC address, subnet mask, default gateway, and public IP lookup.
- **🔍 LAN Device Discovery**: ARP scan and ping sweep with automated hostname resolution across any custom target CIDR network.
- **🚪 Port Scanner**: Common ports, top-1000 ports, and custom specified port audits with protocol & state breakdown.
- **🛡️ Service & Web Recon**: Nmap service version detection, raw TCP banner grabbing, and HTTP server header inspector (`Server`, `X-Powered-By`).
- **💻 Console Log Terminal & Export**: Real-time scan log terminal with export options to full JSON reports.

---

## 🛠️ Local Installation & Setup

1. **Clone the repository**: ```git clone ...```
2. **Install Dependencies**:
   ```bash
   uv pip install -r requirements.txt
   # OR with pip:
   pip install -r requirements.txt
   ```

3. **Ensure Nmap is Installed** (Recommended for advanced port scanning and service detection):
   - **Windows**: Download & install Nmap from [nmap.org](https://nmap.org/download.html). Ensure `nmap.exe` is added to system `PATH`.
   - **Linux / macOS**: `sudo apt update && sudo apt install -y nmap` or `brew install nmap`.

4. **Run Dashboard**:
   ```bash
   uv run python app.py
   # OR with python:
   python app.py
   ```
   Open your browser at `http://127.0.0.1:5000`.

---


## 📂 Project Architecture

```
shit43_network/
├── app.py                  # Main Flask application & Async REST API server
├── static/
│   ├── css/
│   │   └── style.css       # Glassmorphism dark-theme dashboard CSS
│   └── js/
│       └── main.js         # Single-page UI state management & API fetcher
├── templates/
│   └── index.html          # Clean HTML template referencing style.css & main.js
├── system.py               # CPU, Memory, Disk & System Info module
├── network.py              # Interface, IP, MAC & Gateway detection module
├── lan_discovery.py        # ARP scan, Ping sweep & Hostname resolution module
├── port_scanner.py         # Port scan engines (Top ports, Custom, Full range)
├── service_detection.py    # Service versioning, Banner grabber & HTTP inspector
├── utils.py                # IP validation, CIDR calculators & tabulate helpers
├── requirements.txt        # Python dependency manifest
├── Procfile                # WSGI Production app declaration
└── README.md               # Documentation
```
