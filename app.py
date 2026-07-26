from flask import Flask, render_template, jsonify, request
import uuid
import threading
import time
import psutil
import traceback

# Import custom functions from existing project modules
import system
import network
import lan_discovery
import port_scanner
import service_detection
import utils

app = Flask(__name__)

# Global thread-safe task store for non-blocking asynchronous scans
TASKS = {}
TASKS_LOCK = threading.Lock()

def create_task(task_type, target):
    task_id = str(uuid.uuid4())[:8]
    with TASKS_LOCK:
        TASKS[task_id] = {
            "id": task_id,
            "type": task_type,
            "target": target,
            "status": "running",
            "progress": 10,
            "logs": [f"[{time.strftime('%H:%M:%S')}] Started {task_type} for target: {target}"],
            "result": None,
            "error": None,
            "start_time": time.time(),
            "elapsed": 0
        }
    return task_id

def update_task(task_id, status=None, progress=None, log=None, result=None, error=None):
    with TASKS_LOCK:
        if task_id not in TASKS:
            return
        task = TASKS[task_id]
        if status:
            task["status"] = status
        if progress is not None:
            task["progress"] = progress
        if log:
            task["logs"].append(f"[{time.strftime('%H:%M:%S')}] {log}")
        if result is not None:
            task["result"] = result
        if error is not None:
            task["error"] = str(error)
        task["elapsed"] = round(time.time() - task["start_time"], 2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/system", methods=["GET"])
def api_system():
    """Returns host system info and resource utilization metrics."""
    try:
        # Use psutil non-blocking cpu percent for instant response
        cpu_usage = psutil.cpu_percent(interval=None)
        os_sys, os_ver = system.get_os_info()
        
        data = {
            "hostname": system.get_hostname(),
            "username": system.get_username(),
            "os_system": os_sys,
            "os_version": os_ver,
            "architecture": system.get_machine_architecture(),
            "processor": system.get_processor_name(),
            "cpu_usage": cpu_usage,
            "memory": system.get_memory_info(),
            "disks": system.get_disk_info(),
            "boot_time": system.get_boot_time(),
            "uptime": system.get_uptime()
        }
        return jsonify({"success": True, "data": data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/network", methods=["GET"])
def api_network():
    """Returns local network interface details and public IP."""
    try:
        gateway = None
        try:
            gateway = network.get_default_gateway()
        except Exception:
            gateway = "N/A (OS / Permission limitation)"

        data = {
            "interfaces": network.get_interfaces(),
            "active_interface": network.get_active_interface(),
            "ipv4": network.get_ipv4(),
            "ipv6": network.get_ipv6(),
            "mac_address": network.get_mac_address(),
            "subnet_mask": network.get_subnet_mask(),
            "default_gateway": gateway,
            "public_ip": network.get_public_ip(),
            "network_cidr": network.get_network()
        }
        return jsonify({"success": True, "data": data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ping", methods=["POST"])
def api_ping():
    """Synchronous fast ICMP ping check for a single IP."""
    req = request.get_json(silent=True) or {}
    target_ip = req.get("ip") or network.get_ipv4() or "8.8.8.8"
    
    try:
        result = lan_discovery.ping_host(target_ip)
        return jsonify({"success": True, "target": target_ip, "result": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==============================================================================
# ASYNCHRONOUS SCAN ENDPOINTS (Non-Blocking)
# ==============================================================================

@app.route("/api/scan/lan", methods=["POST"])
def api_scan_lan():
    """Triggers an asynchronous LAN Discovery / Device Scan."""
    req = request.get_json(silent=True) or {}
    target_net = req.get("network") or network.get_network() or "192.168.1.0/24"
    mode = req.get("mode", "full")  # 'full', 'arp', 'ping_sweep'

    task_id = create_task(f"LAN Discovery ({mode})", target_net)

    def worker():
        try:
            update_task(task_id, progress=25, log=f"Executing {mode} scan on {target_net}...")
            
            if mode == "ping_sweep":
                hosts = lan_discovery.ping_sweep(target_net)
                devices = [{"ip": host, "mac": "N/A", "hostname": lan_discovery.resolve_hostname(host)} for host in hosts]
            elif mode == "arp":
                devices = lan_discovery.arp_scan(target_net)
            else:
                devices = lan_discovery.discover_devices(target_net)

            update_task(task_id, progress=90, log=f"Discovered {len(devices)} active host(s).")
            update_task(task_id, status="completed", progress=100, log="LAN Discovery finished successfully.", result=devices)
        except Exception as e:
            err_msg = f"LAN Scan error: {str(e)}"
            if "nmap" in str(e).lower():
                err_msg += " (Ensure nmap binary is installed and executable)"
            update_task(task_id, status="failed", progress=100, log=err_msg, error=err_msg)

    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"success": True, "task_id": task_id})


@app.route("/api/scan/ports", methods=["POST"])
def api_scan_ports():
    """Triggers an asynchronous Port Scan."""
    req = request.get_json(silent=True) or {}
    target_ip = req.get("ip") or network.get_ipv4() or "127.0.0.1"
    scan_type = req.get("scan_type", "common")  # 'common', 'top1000', 'all', 'custom'
    custom_ports = req.get("ports", [21, 22, 80, 443, 8080, 3306, 3389])

    task_id = create_task(f"Port Scan ({scan_type})", target_ip)

    def worker():
        try:
            update_task(task_id, progress=20, log=f"Initiating {scan_type} port scan on {target_ip}...")
            
            if scan_type == "top1000":
                results = port_scanner.scan_top_ports(target_ip)
            elif scan_type == "all":
                update_task(task_id, progress=30, log="Scanning all 65535 ports... this may take a few moments.")
                results = port_scanner.scan_all_ports(target_ip)
            elif scan_type == "custom" or scan_type == "common":
                ports_to_scan = custom_ports if scan_type == "custom" else [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 3306, 3389, 8080]
                results = port_scanner.scan_ports(target_ip, ports_to_scan)
            else:
                results = port_scanner.scan_top_ports(target_ip)

            open_count = len([p for p in results if p.get("state") == "open"])
            update_task(task_id, progress=90, log=f"Scan complete. Found {open_count} open port(s) out of {len(results)} scanned.")
            update_task(task_id, status="completed", progress=100, log="Port scan finalized.", result=results)
        except Exception as e:
            err_msg = f"Port scan error: {str(e)}"
            update_task(task_id, status="failed", progress=100, log=err_msg, error=err_msg)

    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"success": True, "task_id": task_id})


@app.route("/api/scan/services", methods=["POST"])
def api_scan_services():
    """Triggers an asynchronous Service & Version Detection scan."""
    req = request.get_json(silent=True) or {}
    target_ip = req.get("ip") or network.get_ipv4() or "127.0.0.1"
    ports = req.get("ports", [22, 80, 443, 8080])

    task_id = create_task("Service Detection", target_ip)

    def worker():
        try:
            update_task(task_id, progress=20, log=f"Probing services on {target_ip} for ports: {ports}...")
            services = service_detection.detect_services(target_ip, ports)
            
            # Grab HTTP server details if port 80/443 included
            http_info = service_detection.detect_http_server(target_ip)
            
            result_payload = {
                "ip": target_ip,
                "services": services,
                "http_info": http_info
            }
            update_task(task_id, progress=90, log=f"Service detection finished. Identified {len(services)} active service(s).")
            update_task(task_id, status="completed", progress=100, log="Service scan completed.", result=result_payload)
        except Exception as e:
            err_msg = f"Service detection error: {str(e)}"
            update_task(task_id, status="failed", progress=100, log=err_msg, error=err_msg)

    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"success": True, "task_id": task_id})


@app.route("/api/scan/banner", methods=["POST"])
def api_scan_banner():
    """Grabs TCP banner from target IP and port."""
    req = request.get_json(silent=True) or {}
    target_ip = req.get("ip")
    port = req.get("port")
    
    if not target_ip or not port:
        return jsonify({"success": False, "error": "IP and Port required."}), 400
        
    try:
        banner = service_detection.grab_banner(target_ip, int(port))
        return jsonify({"success": True, "ip": target_ip, "port": port, "banner": banner or "No banner returned / connection timed out"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/scan/http", methods=["POST"])
def api_scan_http():
    """Analyzes HTTP headers on target host."""
    req = request.get_json(silent=True) or {}
    target_ip = req.get("ip")
    
    if not target_ip:
        return jsonify({"success": False, "error": "Target IP required."}), 400

    try:
        http_data = service_detection.detect_http_server(target_ip)
        return jsonify({"success": True, "ip": target_ip, "http_info": http_data or "No HTTP server responded."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/tasks/<task_id>", methods=["GET"])
def get_task_status(task_id):
    """Retrieves status, logs, and results for a specific task."""
    with TASKS_LOCK:
        task = TASKS.get(task_id)
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404
        return jsonify({"success": True, "task": task})


@app.route("/api/tasks", methods=["GET"])
def get_all_tasks():
    """Returns history of all executed scan tasks."""
    with TASKS_LOCK:
        return jsonify({"success": True, "tasks": list(TASKS.values())})


if __name__ == "__main__":
    print("==========================================================")
    print("🚀 Network Recon Dashboard Server starting on http://127.0.0.1:5000")
    print("==========================================================")
    app.run(host="0.0.0.0", port=5000, debug=True)
