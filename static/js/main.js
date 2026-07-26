// Global State & Charts
let chartCpu, chartRam, chartDisk;
let globalSystemData = {};
let globalNetworkData = {};

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    refreshDashboardData();
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

// Initialize Chart.js Gauges
function initCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: { legend: { display: false } }
    };

    // CPU Chart (#FF9F1C Orange Accent)
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

    // RAM Chart (#5A189A Deep Purple Accent)
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

    // Disk Chart (#7b2cbf Bright Purple Accent)
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

// Fetch System & Network Telemetry
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

        // Update Doughnuts
        chartCpu.data.datasets[0].data = [sys.cpu_usage, 100 - sys.cpu_usage];
        chartCpu.update();

        chartRam.data.datasets[0].data = [sys.memory.percent, 100 - sys.memory.percent];
        chartRam.update();

        chartDisk.data.datasets[0].data = [diskAvg, 100 - diskAvg];
        chartDisk.update();

        // Populate Specs Grid
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
            document.getElementById('bannerIp').value = net.ipv4;
            document.getElementById('httpIp').value = net.ipv4;
        }

        // Populate Network Grid
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

// LAN Scan Trigger & Task Poller
async function triggerLanScan(btnEl) {
    const cidr = document.getElementById('lanCidrInput').value;
    const mode = document.getElementById('lanScanMode').value;
    if (!cidr) return;

    const targetBtn = btnEl || 'btnLanScan';
    setButtonLoading(targetBtn, true, 'Scanning...');
    setScanStatus(true, "[SCANNING LAN]");
    document.getElementById('lanProgressBox').style.display = 'block';

    logToConsole(`Executing $ netrecon --lan ${cidr} (${mode})...`, 'info');

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
                renderLanTable(task.result || []);
                logToConsole(`LAN Scan complete. Discovered ${task.result ? task.result.length : 0} host(s).`, 'success');
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">No active hosts discovered on subnet.</td></tr>';
        return;
    }

    tbody.innerHTML = devices.map(d => `
        <tr>
            <td><span class="badge badge-open">[UP]</span></td>
            <td><strong>${d.ip}</strong></td>
            <td>${d.mac || 'N/A'}</td>
            <td>${d.hostname || 'Unresolved'}</td>
            <td>
                <button class="btn btn-sm btn-purple" onclick="setAndPortScan('${d.ip}')">Scan Ports</button>
                <button class="btn btn-sm" onclick="setAndServiceScan('${d.ip}')">Inspect</button>
            </td>
        </tr>
    `).join('');
}

// Port Scan Trigger & Poller
async function triggerPortScan(btnEl) {
    const ip = document.getElementById('portTargetIp').value;
    const scanType = document.getElementById('portScanType').value;
    const customPortsStr = document.getElementById('customPortList').value;
    
    let customPorts = [80, 443];
    if (customPortsStr) {
        customPorts = customPortsStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    }

    if (!ip) return;

    const targetBtn = btnEl || 'btnPortScan';
    setButtonLoading(targetBtn, true, 'Auditing...');
    setScanStatus(true, "[AUDITING PORTS]");
    document.getElementById('portProgressBox').style.display = 'block';
    logToConsole(`Executing $ scan_ports -t ${ip} (${scanType})...`, 'info');

    try {
        const res = await fetch('/api/scan/ports', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ip: ip, scan_type: scanType, ports: customPorts})
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

// Service Detection
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

    tbody.innerHTML = services.map(s => `
        <tr>
            <td><strong>Port ${s.port}</strong></td>
            <td><span class="badge badge-info">[${(s.service || 'Unknown').toUpperCase()}]</span></td>
            <td>${(s.product || '') + ' ' + (s.version || '')}</td>
            <td>${s.extrainfo || '--'}</td>
        </tr>
    `).join('');
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
    const ip = document.getElementById('httpIp').value;
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
        if (json.success && json.http_info) {
            const info = json.http_info;
            document.getElementById('httpHeaderServer').innerText = info.server || 'Not disclosed';
            document.getElementById('httpHeaderPowered').innerText = info.powered_by || 'Not disclosed';
            logToConsole(`HTTP Inspect result: Server=${info.server}, PoweredBy=${info.powered_by}`, 'success');
        } else {
            document.getElementById('httpHeaderServer').innerText = 'No response';
            document.getElementById('httpHeaderPowered').innerText = 'No response';
        }
    } catch (e) {
        logToConsole(`HTTP inspect error: ${e.message}`, 'error');
    } finally {
        setButtonLoading(targetBtn, false);
    }
}

// Poller Helper
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
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `NetRecon_Report_${Date.now()}.json`);
    downloadAnchor.click();
    downloadAnchor.remove();
    logToConsole('Exported Recon Report JSON.', 'success');
}
