# 💡 NetRecon Project - Future Enhancement Suggestions

This document outlines recommended future improvements, feature additions, and optimization ideas for the **NetRecon Dashboard**.

---

## ⚡ 1. Performance & Stealth Optimizations

2. **Nmap Scan Timing & Speed Profiles**
   - Add scan speed presets in the UI for Nmap timing templates:
     - `-T1` / `-T2`: Paranoid / Sneaky (Stealthy, avoids IDS detection)
     - `-T3`: Normal
     - `-T4` / `-T5`: Aggressive / Insane (Max speed for local lab testing)
---

## 🛡️ 2. Reconnaissance & Vulnerability Intelligence

4. **MAC Address Vendor (OUI) Lookup**
   - Integrate an OUI database (or offline IEEE list) to resolve MAC prefixes to manufacturer names (e.g. `Apple, Inc.`, `Raspberry Pi Foundation`, `Cisco Systems`).
   - **Benefit**: Instantly identifies device types on local networks.

5. **CVE & Vulnerability Mapping**
   - Automatically cross-reference detected service products & versions (e.g. `Apache 2.4.41`, `OpenSSH 7.4`) with open CVE APIs (e.g. CIRCL CVE Search or VulnCheck).
   - **Benefit**: Flags known security vulnerabilities and CVE IDs directly in the Service Recon table.

6. **SSL/TLS Certificate Inspector**
   - Automatically extract HTTPS certificate details for port 443/8443 (Issuer, Valid From/To, Subject Alt Names, Key Size).
   - **Benefit**: Helps identify expired or misconfigured SSL certificates on discovered hosts.

7. **Passive OS Fingerprinting (`-O`)**
   - Include Nmap TCP/IP stack OS detection (`-O`) to guess target Operating Systems (Linux, Windows, macOS, Embedded Router Firmware).

---

## 🎨 3. UI & Visual Dashboard Enhancements

8. **Interactive Network Topology Graph**
   - Add an interactive visual network node graph (using `D3.js`) representing the local network:
     - Center Node: Gateway / Router
     - Connected Nodes: Discovered LAN Hosts
     - Leaf Nodes: Open Ports & Services

9. **PDF & HTML Report Exporter**
   - In addition to JSON export, add one-click generation of styled executive PDF or HTML scan reports.

10. **Target Presets & History Manager**
    - Store previous scan targets in browser `localStorage` for quick re-scanning.

---

## 🖥️ 4. Desktop Packaging

11. **Bundle Nmap with the portable exe**
    - Ship a private `nmap.exe` next to the frozen Flask backend so ARP / version scans work without a system Nmap install.
    - Respect Nmap license terms if redistributing.

12. **Optional admin manifest**
    - Offer a second build with `requestedExecutionLevel: requireAdministrator` for scan types that need raw sockets on Windows.

---
