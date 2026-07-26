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
