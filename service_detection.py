import nmap
import socket
import requests
import ssl
from datetime import datetime
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor

def detect_services(ip, ports):
    scanner = nmap.PortScanner()

    scanner.scan(
        hosts=str(ip),
        ports=",".join(map(str, ports)),
        arguments="-Pn -sV"
    )

    if str(ip) not in scanner.all_hosts():
        return []

    results = []

    for protocol in scanner[str(ip)].all_protocols():
        for port, info in scanner[str(ip)][protocol].items():

            # Skip anything that isn't open
            if info.get("state") != "open":
                continue

            results.append({
                "port": port,
                "protocol": protocol,
                "state": info.get("state"),
                "service": info.get("name"),
                "product": info.get("product"),
                "version": info.get("version"),
                "extrainfo": info.get("extrainfo")
            })

    return sorted(results, key=lambda x: x["port"])

def detect_service(ip, port):
    services = detect_services(ip, [port])

    if services:
        return services[0]

    return None


def detect_host_services(device):
    device = deepcopy(device)

    open_ports = [
        port["port"]
        for port in device["ports"]
        if port["state"] == "open"
    ]

    if not open_ports:
        device["ports"] = []
        return device

    device["ports"] = detect_services(device["ip"], open_ports)

    return device

def detect_network_services(devices):
    with ThreadPoolExecutor() as executor:
        results = list(
            executor.map(
                detect_host_services,
                devices
            )
        )

    return results

# ==================================================

def grab_banner(ip, port):
    try:
        with socket.create_connection((str(ip), port), timeout=3) as connection:
            connection.settimeout(3)
            return connection.recv(1024).decode(errors="ignore").strip()

    except Exception:
        return None

def detect_http_server(ip):
    for protocol in ("http", "https"):
        try:
            response = requests.get(
                f"{protocol}://{ip}",
                timeout=5,
                verify=False
            )

            return {
                "protocol": protocol.upper(),
                "status": response.status_code,
                "server": response.headers.get("Server"),
                "powered_by": response.headers.get("X-Powered-By")
            }

        except requests.RequestException:
            continue

    return None

def detect_os(ip):
    try:
        scanner = nmap.PortScanner()
        scanner.scan(hosts=str(ip), arguments="-Pn -O --osscan-guess")
        if str(ip) in scanner.all_hosts() and "osmatch" in scanner[str(ip)]:
            os_matches = scanner[str(ip)]["osmatch"]
            if os_matches:
                top_match = os_matches[0]
                return {
                    "name": top_match.get("name"),
                    "accuracy": top_match.get("accuracy"),
                    "osfamily": top_match.get("osclass", [{}])[0].get("osfamily") if top_match.get("osclass") else "Unknown"
                }
    except Exception:
        pass
    return None

def inspect_ssl_cert(ip, port=443):
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with socket.create_connection((str(ip), int(port)), timeout=4) as sock:
            with ctx.wrap_socket(sock, server_hostname=str(ip)) as ssock:
                cert = ssock.getpeercert(binary_form=False)
                cipher = ssock.cipher()
                if not cert:
                    return {"status": "Active SSL/TLS", "cipher": cipher[0] if cipher else "Unknown"}
                
                issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                subject_dict = dict(x[0] for x in cert.get("subject", []))
                
                return {
                    "issuer": issuer_dict.get("organizationName") or issuer_dict.get("commonName") or "Unknown",
                    "subject": subject_dict.get("commonName") or "Unknown",
                    "valid_from": cert.get("notBefore"),
                    "valid_to": cert.get("notAfter"),
                    "cipher": cipher[0] if cipher else "Unknown"
                }
    except Exception as e:
        return {"error": str(e)}

def query_cve(product, version=None):
    if not product:
        return []
    try:
        query_str = f"{product}".strip().lower()
        resp = requests.get(f"https://cve.circl.lu/api/search/{query_str}", timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                cves = []
                for item in data[:5]:
                    cves.append({
                        "id": item.get("id"),
                        "summary": (item.get("summary") or "")[:120] + "...",
                        "cvss": item.get("cvss")
                    })
                return cves
    except Exception:
        pass
    return []

