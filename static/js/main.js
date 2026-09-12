// Global State & Charts
let chartCpu, chartRam, chartDisk;
let globalSystemData = {};
let globalNetworkData = {};
let globalDiscoveredDevices = [];
let d3Simulation = null;

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    refreshDashboardData();
    renderHistoryTags();
    initTopologyGraph();
    // Auto refresh telemetry every 5 seconds
    setInterval(fetchSystemMetrics, 5000);
});

// Helper to toggle button loading state with a spinner
function setButtonLoading(btnOrId, isLoading, loadingText = 'Processing...') {
    let btn = btnOrId;
    if (typeof btnOrId === 'string') {
        btn = document.getElementById(btnOrId);
    }
    if (!btn || !(btn instanceof HTMLElement)) return;

    if (isLoading) {
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
        }
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}`;
    } else {
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}

// Tab Navigation
function switchTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

function toggleCustomPortInput() {
    const val = document.getElementById('portScanType').value;
    document.getElementById('customPortList').style.display = (val === 'custom') ? 'inline-block' : 'none';
}

// Generate ASCII Progress Bar String
function getAsciiProgressBar(percent, statusText = '') {
    const totalBlocks = 20;
    const filled = Math.min(totalBlocks, Math.max(0, Math.round((percent / 100) * totalBlocks)));
    const empty = totalBlocks - filled;
    const bar = '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    return `${bar} ${percent}% -- ${statusText}`;
}

// Target History (localStorage)
function saveTargetHistory(targetStr) {
    if (!targetStr) return;
    try {
        let history = JSON.parse(localStorage.getItem('portatlas_history') || '[]');
        if (!history.includes(targetStr)) {
            history.unshift(targetStr);
            if (history.length > 5) history.pop();
            localStorage.setItem('portatlas_history', JSON.stringify(history));
            renderHistoryTags();
        }
    } catch (e) {}
}

function renderHistoryTags() {
    const container = document.getElementById('lanHistoryTags');
    if (!container) return;
    try {
        const history = JSON.parse(localStorage.getItem('portatlas_history') || '[]');
        if (history.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = 'Recent Targets: ' + history.map(t => `<span style="background:var(--bg-card-header); border:1px solid var(--border-color); padding:2px 6px; margin-right:4px; cursor:pointer; border-radius:2px;" onclick="useHistoryTarget('${t}')">${t}</span>`).join('');
    } catch (e) {}
}

function useHistoryTarget(targetStr) {
    document.getElementById('lanCidrInput').value = targetStr;
}

// Initialize Chart.js Gauges
function initCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: { legend: { display: false } }
    };

    chartCpu = new Chart(document.getElementById('chartCpu'), {
        type: 'doughnut',
        data: {
            labels: ['Used', 'Free'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#FF9F1C', '#1b132e'],
                borderWidth: 1,
                borderColor: '#2b1f42'
            }]
        },
        options: chartOptions
    });

    chartRam = new Chart(document.getElementById('chartRam'), {
        type: 'doughnut',
        data: {
            labels: ['Used', 'Free'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#5A189A', '#1b132e'],
                borderWidth: 1,
                borderColor: '#2b1f42'
            }]
        },
        options: chartOptions
    });

    chartDisk = new Chart(document.getElementById('chartDisk'), {
        type: 'doughnut',
        data: {
            labels: ['Used', 'Free'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#7b2cbf', '#1b132e'],
                borderWidth: 1,
                borderColor: '#2b1f42'
            }]
        },
        options: chartOptions
    });
}

// Log to terminal console
function logToConsole(message, type = 'info') {
    const consoleBox = document.getElementById('terminalConsole');
    if (!consoleBox) return;
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    line.innerText = `[${timestamp}] ${message}`;
    consoleBox.appendChild(line);
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

function clearConsole() {
    document.getElementById('terminalConsole').innerHTML = '';
    logToConsole('Console cleared.', 'info');
}

// Fetch Telemetry
async function refreshDashboardData(btnEl) {
    setButtonLoading(btnEl || 'btnRefresh', true, 'Refreshing...');
    try {
        await fetchSystemMetrics();
        await fetchNetworkMetrics();
    } finally {
        setButtonLoading(btnEl || 'btnRefresh', false);
    }
}

async function fetchSystemMetrics() {
    try {
        const res = await fetch('/api/system');
        const json = await res.json();
        if (!json.success) return;
        
        const sys = json.data;
        globalSystemData = sys;

        document.getElementById('hdrHost').innerText = `Host: ${sys.hostname}`;
        document.getElementById('cpuPercentTxt').innerText = `${sys.cpu_usage}%`;
        document.getElementById('ramPercentTxt').innerText = `${sys.memory.percent}%`;
        
        let diskAvg = sys.disks.length > 0 ? sys.disks[0].percentage : 0;
        document.getElementById('diskPercentTxt').innerText = `${diskAvg}%`;

        chartCpu.data.datasets[0].data = [sys.cpu_usage, 100 - sys.cpu_usage];
        chartCpu.update();

        chartRam.data.datasets[0].data = [sys.memory.percent, 100 - sys.memory.percent];
        chartRam.update();

        chartDisk.data.datasets[0].data = [diskAvg, 100 - diskAvg];
        chartDisk.update();

        const specsGrid = document.getElementById('sysSpecsGrid');
        specsGrid.innerHTML = `
            <div class="kv-item"><div class="kv-label">[HOSTNAME]</div><div class="kv-value">${sys.hostname}</div></div>
            <div class="kv-item"><div class="kv-label">[USER]</div><div class="kv-value">${sys.username}</div></div>
            <div class="kv-item"><div class="kv-label">[OS_SYSTEM]</div><div class="kv-value">${sys.os_system}</div></div>
            <div class="kv-item"><div class="kv-label">[ARCHITECTURE]</div><div class="kv-value">${sys.architecture}</div></div>
            <div class="kv-item"><div class="kv-label">[PROCESSOR]</div><div class="kv-value">${sys.processor || 'N/A'}</div></div>
            <div class="kv-item"><div class="kv-label">[UPTIME]</div><div class="kv-value">${sys.uptime}</div></div>
        `;
    } catch (err) {
        console.error('System fetch error:', err);
    }
}

async function fetchNetworkMetrics() {
    try {
        const res = await fetch('/api/network');
        const json = await res.json();
        if (!json.success) return;

        const net = json.data;
        globalNetworkData = net;

        document.getElementById('hdrPublicIp').innerText = `Public IP: ${net.public_ip || 'N/A'}`;
        if (net.network_cidr) {
            document.getElementById('lanCidrInput').value = net.network_cidr;
        }
        if (net.ipv4) {
            document.getElementById('pingTargetIp').value = net.default_gateway || '8.8.8.8';
            document.getElementById('portTargetIp').value = net.ipv4;
            document.getElementById('svcTargetIp').value = net.ipv4;
            document.getElementById('osTargetIp').value = net.ipv4;
            if (document.getElementById('sslIp')) document.getElementById('sslIp').value = net.ipv4;
            if (document.getElementById('bannerIp')) document.getElementById('bannerIp').value = net.ipv4;
            if (document.getElementById('httpIp')) document.getElementById('httpIp').value = net.ipv4;
        }

        const netGrid = document.getElementById('netDetailsGrid');
        netGrid.innerHTML = `
            <div class="kv-item"><div class="kv-label">[ACTIVE_INTERFACE]</div><div class="kv-value">${net.active_interface || 'N/A'}</div></div>
            <div class="kv-item"><div class="kv-label">[IPV4_ADDRESS]</div><div class="kv-value">${net.ipv4 || 'N/A'}</div></div>
            <div class="kv-item"><div class="kv-label">[SUBNET_MASK]</div><div class="kv-value">${net.subnet_mask || 'N/A'}</div></div>
            <div class="kv-item"><div class="kv-label">[DEFAULT_GATEWAY]</div><div class="kv-value">${net.default_gateway || 'N/A'}</div></div>
            <div class="kv-item"><div class="kv-label">[MAC_ADDRESS]</div><div class="kv-value">${net.mac_address || 'N/A'}</div></div>
            <div class="kv-item"><div class="kv-label">[TARGET_NETWORK]</div><div class="kv-value">${net.network_cidr || 'N/A'}</div></div>
        `;
    } catch (err) {
        console.error('Network fetch error:', err);
    }
}

// Quick Ping Diagnostic
async function executePing(btnEl) {
    const ip = document.getElementById('pingTargetIp').value;
    if (!ip) return;

    setButtonLoading(btnEl || 'btnPing', true, 'Pinging...');
    logToConsole(`Executing ICMP Ping to: ${ip}...`, 'info');

    try {
        const res = await fetch('/api/ping', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ip: ip})
        });
        const json = await res.json();
        
        const grid = document.getElementById('pingResultGrid');
        if (json.success && json.result) {
            const r = json.result;
            const statusHtml = r.alive ? '<span style="color:#34d399">[ONLINE]</span>' : '<span style="color:#fb7185">[UNREACHABLE]</span>';
            grid.innerHTML = `
                <div class="kv-item"><div class="kv-label">[STATUS]</div><div class="kv-value">${statusHtml}</div></div>
                <div class="kv-item"><div class="kv-label">[AVG_RTT]</div><div class="kv-value">${r.avg_rtt ? r.avg_rtt + ' ms' : '--'}</div></div>
                <div class="kv-item"><div class="kv-label">[MIN/MAX_RTT]</div><div class="kv-value">${r.min_rtt || '--'} / ${r.max_rtt || '--'} ms</div></div>
                <div class="kv-item"><div class="kv-label">[PACKETS_SENT/RECV]</div><div class="kv-value">${r.packets_sent} / ${r.packets_received}</div></div>
            `;
            logToConsole(`Ping to ${ip} completed. Host alive: ${r.alive}`, r.alive ? 'success' : 'error');
        }
    } catch (e) {
        logToConsole(`Ping error: ${e.message}`, 'error');
    } finally {
        setButtonLoading(btnEl || 'btnPing', false);
    }
}

// LAN Scan & Topology Graph
async function triggerLanScan(btnEl) {
    const cidr = document.getElementById('lanCidrInput').value;
    const mode = document.getElementById('lanScanMode').value;
    if (!cidr) return;

    saveTargetHistory(cidr);
    const targetBtn = btnEl || 'btnLanScan';
    setButtonLoading(targetBtn, true, 'Scanning...');
    setScanStatus(true, "[SCANNING LAN]");
    document.getElementById('lanProgressBox').style.display = 'block';

    logToConsole(`Executing $ portatlas --lan ${cidr} (${mode})...`, 'info');

    try {
        const res = await fetch('/api/scan/lan', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({network: cidr, mode: mode})
        });
        const json = await res.json();
        if (json.success) {
            pollTask(json.task_id, (task) => {
                const lastLog = task.logs[task.logs.length - 1] || 'Scanning...';
                document.getElementById('lanProgressBarTxt').innerText = getAsciiProgressBar(task.progress, lastLog);
            }, (task) => {
                setButtonLoading(targetBtn, false);
                setScanStatus(false, "[SYSTEM READY]");
                const devices = task.result || [];
                globalDiscoveredDevices = devices;
                renderLanTable(devices);
                updateTopologyGraph(devices);
                logToConsole(`LAN Scan complete. Discovered ${devices.length} host(s).`, 'success');
            });
        } else {
            setButtonLoading(targetBtn, false);
            setScanStatus(false, "[SCAN ERROR]");
        }
    } catch (e) {
        setButtonLoading(targetBtn, false);
        logToConsole(`LAN trigger failed: ${e.message}`, 'error');
        setScanStatus(false, "[SCAN ERROR]");
    }
}

function renderLanTable(devices) {
    const tbody = document.getElementById('lanDeviceTableBody');
    if (!devices || devices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim);">No active hosts discovered on subnet.</td></tr>';
        return;
    }

    tbody.innerHTML = devices.map(d => `
        <tr>
            <td><span class="badge badge-open">[UP]</span></td>
            <td><strong>${d.ip}</strong></td>
            <td>${d.mac || 'N/A'}</td>
            <td><span class="badge badge-info">${d.vendor || 'Unknown'}</span></td>
            <td>${d.hostname || 'Unresolved'}</td>
            <td>
                <button class="btn btn-sm btn-purple" onclick="setAndPortScan('${d.ip}')">Scan Ports</button>
                <button class="btn btn-sm" onclick="setAndServiceScan('${d.ip}')">Inspect</button>
            </td>
        </tr>
    `).join('');
}

// Port Scan Trigger & Timing Template
async function triggerPortScan(btnEl) {
    const ip = document.getElementById('portTargetIp').value;
    const scanType = document.getElementById('portScanType').value;
    const timing = parseInt(document.getElementById('portTiming').value || 4);
    const customPortsStr = document.getElementById('customPortList').value;
    
    let customPorts = [80, 443];
    if (customPortsStr) {
        customPorts = customPortsStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    }

    if (!ip) return;
    saveTargetHistory(ip);

    const targetBtn = btnEl || 'btnPortScan';
    setButtonLoading(targetBtn, true, `Auditing (-T${timing})...`);
    setScanStatus(true, `[AUDITING PORTS -T${timing}]`);
    document.getElementById('portProgressBox').style.display = 'block';
    logToConsole(`Executing $ scan_ports -t ${ip} (${scanType}, -T${timing})...`, 'info');

    try {
        const res = await fetch('/api/scan/ports', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ip: ip, scan_type: scanType, ports: customPorts, timing: timing})
        });
        const json = await res.json();
        if (json.success) {
            pollTask(json.task_id, (task) => {
                const lastLog = task.logs[task.logs.length - 1] || 'Auditing ports...';
                document.getElementById('portProgressBarTxt').innerText = getAsciiProgressBar(task.progress, lastLog);
            }, (task) => {
                setButtonLoading(targetBtn, false);
                setScanStatus(false, "[SYSTEM READY]");
                renderPortTable(task.result || []);
                logToConsole(`Port audit complete for ${ip}.`, 'success');
            });
        } else {
            setButtonLoading(targetBtn, false);
            setScanStatus(false, "[SCAN ERROR]");
        }
    } catch (e) {
        setButtonLoading(targetBtn, false);
        logToConsole(`Port scan error: ${e.message}`, 'error');
        setScanStatus(false, "[SCAN ERROR]");
    }
}

function renderPortTable(ports) {
    const tbody = document.getElementById('portResultsTableBody');
    if (!ports || ports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-dim);">No open ports found.</td></tr>';
        return;
    }

    tbody.innerHTML = ports.map(p => {
        const isOpen = p.state === 'open';
        const badgeClass = isOpen ? 'badge-open' : 'badge-closed';
        return `
            <tr>
                <td><strong>Port ${p.port}</strong></td>
                <td>${(p.protocol || 'tcp').toUpperCase()}</td>
                <td><span class="badge ${badgeClass}">[${p.state.toUpperCase()}]</span></td>
                <td>${getCommonServiceName(p.port)}</td>
            </tr>
        `;
    }).join('');
}

function setAndPortScan(ip) {
    document.getElementById('portTargetIp').value = ip;
    switchTab('tab-ports');
    triggerPortScan();
}

function setAndServiceScan(ip) {
    document.getElementById('svcTargetIp').value = ip;
    switchTab('tab-services');
    triggerServiceScan();
}

// Service Detection & CVE Mapping
async function triggerServiceScan(btnEl) {
    const ip = document.getElementById('svcTargetIp').value;
    const portListStr = document.getElementById('svcPortList').value;
    let ports = [21, 22, 80, 443, 8080];
    if (portListStr) {
        ports = portListStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    }

    if (!ip) return;
    const targetBtn = btnEl || 'btnSvcScan';
    setButtonLoading(targetBtn, true, 'Detecting...');
    logToConsole(`Executing $ nmap -sV ${ip} -p ${ports.join(',')}...`, 'info');

    try {
        const res = await fetch('/api/scan/services', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ip: ip, ports: ports})
        });
        const json = await res.json();
        if (json.success) {
            pollTask(json.task_id, null, (task) => {
                setButtonLoading(targetBtn, false);
                const resData = task.result || {};
                renderServiceTable(resData.services || []);
                logToConsole(`Service detection completed for ${ip}.`, 'success');
            });
        } else {
            setButtonLoading(targetBtn, false);
        }
    } catch (e) {
        setButtonLoading(targetBtn, false);
        logToConsole(`Service scan error: ${e.message}`, 'error');
    }
}

function renderServiceTable(services) {
    const tbody = document.getElementById('svcTableBody');
    if (!services || services.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-dim);">No active services identified on specified ports.</td></tr>';
        return;
    }

    tbody.innerHTML = services.map(s => {
        let cveHtml = '--';
        if (s.cves && s.cves.length > 0) {
            cveHtml = s.cves.map(c => `<span class="badge badge-closed" title="${c.summary}">[${c.id}]</span>`).join(' ');
        }
        return `
            <tr>
                <td><strong>Port ${s.port}</strong></td>
                <td><span class="badge badge-info">[${(s.service || 'Unknown').toUpperCase()}]</span></td>
                <td>${(s.product || '') + ' ' + (s.version || '')}</td>
                <td>${cveHtml}</td>
            </tr>
        `;
    }).join('');
}

// OS Detection & SSL Inspection
async function triggerOsDetect(btnEl) {
    const ip = document.getElementById('osTargetIp').value;
    if (!ip) return;

    setButtonLoading(btnEl || 'btnOsDetect', true, 'Fingerprinting...');
    logToConsole(`Executing $ nmap -O ${ip}...`, 'info');

    try {
        const res = await fetch('/api/scan/os', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ip: ip})
        });
        const json = await res.json();
        if (json.success && json.os_info) {
            const os = json.os_info;
            document.getElementById('osOutput').innerText = `${os.name || 'Unknown'} (Accuracy: ${os.accuracy || 0}%)`;
            logToConsole(`OS Fingerprint match for ${ip} -> ${os.name}`, 'success');
        } else {
            document.getElementById('osOutput').innerText = 'No OS match found / Require admin privileges.';
        }
    } catch (e) {
        logToConsole(`OS detect error: ${e.message}`, 'error');
    } finally {
        setButtonLoading(btnEl || 'btnOsDetect', false);
    }
}

async function triggerSslInspect(btnEl) {
    const ip = document.getElementById('sslIp').value;
    const port = document.getElementById('sslPort').value || 443;
    if (!ip) return;

    setButtonLoading(btnEl || 'btnSslInspect', true, 'Inspecting...');
    logToConsole(`Executing $ openssl s_client -connect ${ip}:${port}...`, 'info');

    try {
        const res = await fetch('/api/scan/ssl', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ip: ip, port: port})
        });
        const json = await res.json();
        if (json.success && json.ssl_info) {
            const cert = json.ssl_info;
            if (cert.error) {
                document.getElementById('sslIssuer').innerText = `Error: ${cert.error}`;
                document.getElementById('sslValid').innerText = `--`;
                logToConsole(`SSL inspect error for ${ip}:${port}: ${cert.error}`, 'error');
            } else {
                document.getElementById('sslIssuer').innerText = `Issuer: ${cert.issuer || 'N/A'}\nSubject: ${cert.subject || 'N/A'}`;
                document.getElementById('sslValid').innerText = `Valid From: ${cert.valid_from || 'N/A'}\nValid To: ${cert.valid_to || 'N/A'}\nCipher: ${cert.cipher || 'N/A'}`;
                logToConsole(`SSL cert inspection completed for ${ip}:${port}.`, 'success');
            }
        } else {
            document.getElementById('sslIssuer').innerText = json.error || 'Failed to inspect cert';
            document.getElementById('sslValid').innerText = `--`;
        }
    } catch (e) {
        logToConsole(`SSL inspect error: ${e.message}`, 'error');
        document.getElementById('sslIssuer').innerText = `Error: ${e.message}`;
    } finally {
        setButtonLoading(btnEl || 'btnSslInspect', false);
    }
}

// Banner Grabber & HTTP Inspector
async function triggerBannerGrab(btnEl) {
    const ip = document.getElementById('bannerIp').value;
    const port = document.getElementById('bannerPort').value;
    if (!ip || !port) return;

    const targetBtn = btnEl || 'btnBannerGrab';
    setButtonLoading(targetBtn, true, 'Grabbing...');
    logToConsole(`Executing $ nc -v ${ip} ${port}...`, 'info');

    try {
        const res = await fetch('/api/scan/banner', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ip: ip, port: port})
        });
        const json = await res.json();
        document.getElementById('bannerOutput').innerText = json.banner || 'No banner returned.';
        logToConsole(`Banner result for ${ip}:${port} -> ${json.banner}`, 'success');
    } catch (e) {
        document.getElementById('bannerOutput').innerText = `Error: ${e.message}`;
    } finally {
        setButtonLoading(targetBtn, false);
    }
}

async function triggerHttpInspect(btnEl) {
    const ipEl = document.getElementById('httpIp') || document.getElementById('bannerIp');
    const ip = ipEl ? ipEl.value : '';
    if (!ip) return;

    const targetBtn = btnEl || 'btnHttpInspect';
    setButtonLoading(targetBtn, true, 'Inspecting...');
    logToConsole(`Executing $ curl -I ${ip}...`, 'info');

    try {
        const res = await fetch('/api/scan/http', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ip: ip})
        });
        const json = await res.json();
        if (json.success && json.http_info && typeof json.http_info === 'object') {
            const info = json.http_info;
            logToConsole(`HTTP Inspect result for ${ip}: ${info.protocol} ${info.status}`, 'success');

            let outputText = `HTTP/${info.protocol} ${info.status} ${info.reason || ''}\n`;
            outputText += `URL: ${info.url || ip}\n`;
            outputText += `Server: ${info.server || 'N/A'}\n`;
            outputText += `X-Powered-By: ${info.powered_by || 'N/A'}\n`;
            outputText += `Content-Type: ${info.content_type || 'N/A'}\n`;
            if (info.raw_headers) {
                outputText += `\n--- HEADERS ---\n${info.raw_headers}`;
            }
            document.getElementById('bannerOutput').innerText = outputText;
        } else {
            const msg = (json.http_info && typeof json.http_info === 'string') ? json.http_info : 'No HTTP server responded / Connection failed.';
            document.getElementById('bannerOutput').innerText = msg;
            logToConsole(`HTTP Inspect: ${msg}`, 'warning');
        }
    } catch (e) {
        logToConsole(`HTTP inspect error: ${e.message}`, 'error');
        document.getElementById('bannerOutput').innerText = `Error: ${e.message}`;
    } finally {
        setButtonLoading(targetBtn, false);
    }
}

// Interactive D3.js Topology Graph Renderer
function initTopologyGraph() {
    const svg = d3.select('#topologySvg');
    if (svg.empty()) return;
    svg.selectAll('*').remove();
}

function updateTopologyGraph(devices) {
    const svg = d3.select('#topologySvg');
    if (svg.empty()) return;
    svg.selectAll('*').remove();

    const width = svg.node().clientWidth || 600;
    const height = svg.node().clientHeight || 350;

    const nodes = [
        { id: 'Gateway', label: globalNetworkData.default_gateway || 'Gateway', type: 'gateway' }
    ];
    const links = [];

    devices.forEach((dev, idx) => {
        const devId = dev.ip;
        nodes.push({ id: devId, label: `${dev.ip} (${dev.hostname || 'Host'})`, type: 'host' });
        links.push({ source: 'Gateway', target: devId });
    });

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(90))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
        .attr('stroke', '#2b1f42')
        .attr('stroke-width', 2)
        .selectAll('line')
        .data(links)
        .enter().append('line');

    const node = svg.append('g')
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
        .call(d3.drag()
            .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle')
        .attr('r', d => d.type === 'gateway' ? 12 : 8)
        .attr('fill', d => d.type === 'gateway' ? '#FF9F1C' : '#5A189A')
        .attr('stroke', '#FF9F1C')
        .attr('stroke-width', d => d.type === 'gateway' ? 2 : 1);

    node.append('text')
        .text(d => d.label)
        .attr('x', 14)
        .attr('y', 4)
        .attr('fill', '#f3ecfe')
        .attr('font-size', '11px')
        .attr('font-family', 'monospace');

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

// Task Poller
function pollTask(taskId, onProgress, onComplete) {
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/tasks/${taskId}`);
            const json = await res.json();
            if (!json.success) {
                clearInterval(interval);
                return;
            }
            const task = json.task;
            if (onProgress) onProgress(task);

            if (task.logs && task.logs.length > 0) {
                const lastLog = task.logs[task.logs.length - 1];
                logToConsole(lastLog, task.status === 'failed' ? 'error' : 'info');
            }

            if (task.status === 'completed' || task.status === 'failed') {
                clearInterval(interval);
                if (onComplete) onComplete(task);
            }
        } catch (err) {
            clearInterval(interval);
            console.error('Polling task error:', err);
        }
    }, 1000);
}

function setScanStatus(isScanning, text) {
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    if (isScanning) {
        dot.classList.add('scanning');
        txt.innerText = text;
    } else {
        dot.classList.remove('scanning');
        txt.innerText = "[SYSTEM READY]";
    }
}

function getCommonServiceName(port) {
    const map = {
        21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP',
        53: 'DNS', 80: 'HTTP', 110: 'POP3', 135: 'MS-RPC',
        139: 'NetBIOS', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB',
        3306: 'MySQL', 3389: 'RDP', 8080: 'HTTP-Alt'
    };
    return map[port] || 'Custom / Unregistered';
}

async function exportReconReport() {
    const report = {
        timestamp: new Date().toISOString(),
        system: globalSystemData,
        network: globalNetworkData,
        devices: globalDiscoveredDevices
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `PortAtlas_Report_${Date.now()}.json`);
    downloadAnchor.click();
    downloadAnchor.remove();
    logToConsole('Exported Recon Report JSON.', 'success');
}

async function exportHtmlReport() {
    logToConsole('Generating HTML Executive Report...', 'info');
    try {
        const res = await fetch('/api/report/html', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({system: globalSystemData, network: globalNetworkData})
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PortAtlas_Recon_Report_${Date.now()}.html`;
        a.click();
        a.remove();
        logToConsole('HTML Report downloaded successfully.', 'success');
    } catch (e) {
        logToConsole(`HTML report error: ${e.message}`, 'error');
    }
}
