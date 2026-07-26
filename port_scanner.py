import nmap
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor

def scan_ports(ip, ports):
    scanner = nmap.PortScanner()

    scanner.scan(
        hosts=str(ip),
        ports=",".join(map(str, ports)),
        arguments="-Pn"
    )

    if str(ip) not in scanner.all_hosts():
        return []

    results = []

    tcp = scanner[str(ip)].get("tcp", {})

    for port in ports:
        state = tcp.get(port, {}).get("state", "closed")

        results.append({
            "port": port,
            "state": state
        })

    return results

def scan_port(ip, port):
    return scan_ports(ip, [port])[0]

def scan_top_ports(ip):
    scanner = nmap.PortScanner()

    scanner.scan(
        hosts=str(ip),
        arguments="-Pn --top-ports 1000"
    )

    results = []

    if str(ip) not in scanner.all_hosts():
        return results

    for protocol in scanner[str(ip)].all_protocols():
        for port, info in scanner[str(ip)][protocol].items():
            results.append({
                "port": port,
                "protocol": protocol,
                "state": info["state"]
            })

    return sorted(results, key=lambda x: x["port"])

import nmap

def scan_all_ports(ip):
    scanner = nmap.PortScanner()

    scanner.scan(
        hosts=str(ip),
        arguments="-Pn -p-"
    )

    results = []

    if str(ip) not in scanner.all_hosts():
        return results

    for protocol in scanner[str(ip)].all_protocols():
        for port, info in scanner[str(ip)][protocol].items():
            results.append({
                "port": port,
                "protocol": protocol,
                "state": info["state"]
            })

    return sorted(results, key=lambda x: x["port"])

from copy import deepcopy

def scan_network(devices):
    def scan_device(device):
        scanned_device = deepcopy(device)

        scanned_device["ports"] = scan_top_ports(device["ip"])

        return scanned_device

    with ThreadPoolExecutor() as executor:
        results = list(
            executor.map(
                scan_device,
                devices
            )
        )

    return results