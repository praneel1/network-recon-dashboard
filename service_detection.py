import nmap
import socket
import requests
import ssl
import tempfile
import os
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
    target = str(ip).strip()
    if target.startswith("http://"):
        target = target[7:]
    elif target.startswith("https://"):
        target = target[8:]
    if ":" in target and not target.count(":") > 1:
        target = target.split(":")[0]

    try:
        with socket.create_connection((target, int(port)), timeout=3) as connection:
            connection.settimeout(3)
            # Listen first for server-first banners (SSH, FTP, SMTP)
            try:
                banner = connection.recv(1024).decode(errors="ignore").strip()
                if banner:
                    return banner
            except socket.timeout:
                pass

            # If client-first (e.g. HTTP, TCP), send a basic probe
            if int(port) in (80, 443, 8080, 8443):
                connection.sendall(b"HEAD / HTTP/1.0\r\n\r\n")
            else:
                connection.sendall(b"\r\n")

            banner = connection.recv(1024).decode(errors="ignore").strip()
            return banner if banner else "Connected, but no banner payload returned by server."
    except Exception as e:
        return f"Connection error: {str(e)}"

def detect_http_server(ip):
    target = str(ip).strip()
    if target.startswith("http://"):
        target = target[7:]
    elif target.startswith("https://"):
        target = target[8:]

    for protocol in ("https", "http"):
        try:
            url = f"{protocol}://{target}"
            response = requests.head(
                url,
                timeout=4,
                verify=False,
                allow_redirects=True
            )
            if response.status_code in (405, 501):
                response = requests.get(
                    url,
                    timeout=4,
                    verify=False,
                    stream=True
                )

            headers_dict = dict(response.headers)
            headers_str = "\n".join([f"{k}: {v}" for k, v in headers_dict.items()])

            return {
                "protocol": protocol.upper(),
                "status": response.status_code,
                "reason": response.reason,
                "url": response.url,
                "server": response.headers.get("Server") or "Unknown",
                "powered_by": response.headers.get("X-Powered-By") or "N/A",
                "content_type": response.headers.get("Content-Type") or "N/A",
                "raw_headers": headers_str
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
    target = str(ip).strip()
    if target.startswith("https://"):
        target = target[8:]
    elif target.startswith("http://"):
        target = target[7:]
    if ":" in target and not target.count(":") > 1:
        target = target.split(":")[0]

    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        with socket.create_connection((target, int(port)), timeout=4) as sock:
            with ctx.wrap_socket(sock, server_hostname=target) as ssock:
                der_bytes = ssock.getpeercert(binary_form=True)
                cipher = ssock.cipher()

                if not der_bytes:
                    return {"status": "Active SSL/TLS", "cipher": cipher[0] if cipher else "Unknown"}

                pem_str = ssl.DER_cert_to_PEM_cert(der_bytes)
                with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
                    f.write(pem_str)
                    temp_path = f.name

                try:
                    cert_dict = ssl._ssl._test_decode_cert(temp_path)
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)

                issuer_dict = dict(x[0] for x in cert_dict.get("issuer", []))
                subject_dict = dict(x[0] for x in cert_dict.get("subject", []))

                return {
                    "issuer": issuer_dict.get("organizationName") or issuer_dict.get("commonName") or "Unknown",
                    "subject": subject_dict.get("commonName") or subject_dict.get("organizationName") or "Unknown",
                    "valid_from": cert_dict.get("notBefore"),
                    "valid_to": cert_dict.get("notAfter"),
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

