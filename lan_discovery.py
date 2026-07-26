from icmplib import ping
import nmap
import ipaddress
import socket
from network import get_ipv4, get_mac_address

def ping_host(ip, timeout=1):
    host = ping(str(ip), count=1, timeout=timeout)

    return {
        "alive": host.is_alive,
        "avg_rtt": host.avg_rtt,
        "min_rtt": host.min_rtt,
        "max_rtt": host.max_rtt,
        "packets_sent": host.packets_sent,
        "packets_received": host.packets_received,
    }

def ping_sweep(network):
    scanner = nmap.PortScanner()

    scanner.scan(
        hosts=str(network),
        arguments="-sn"
    )

    return [
    str(ipaddress.IPv4Address(host))
    for host in scanner.all_hosts()
    if scanner[host].state() == "up"
]

def arp_scan(network):
    scanner = nmap.PortScanner()

    scanner.scan(
        hosts=str(network),
        arguments="-PR -sn"
    )

    devices = []

    for host in scanner.all_hosts():
        if scanner[host].state() != "up":
            continue

        mac = scanner[host]["addresses"].get("mac")
        vendor = "Unknown"
        if mac and "vendor" in scanner[host] and mac in scanner[host]["vendor"]:
            vendor = scanner[host]["vendor"][mac]

        devices.append({
            "ip": str(ipaddress.IPv4Address(host)),
            "mac": mac,
            "vendor": vendor
        })

    return devices

def get_mac(ip):
    scanner = nmap.PortScanner()

    scanner.scan(
        hosts=str(ip),
        arguments="-PR -sn"
    )

    if str(ip) not in scanner.all_hosts():
        return None

    return scanner[str(ip)]["addresses"].get("mac")

def resolve_hostname(ip):
    try:
        hostname, _, _ = socket.gethostbyaddr(str(ip))
        return hostname

    except socket.herror:
        return None

    except socket.gaierror:
        return None

def discover_devices(network):
    devices = arp_scan(network)

    local_ip = get_ipv4()

    for device in devices:
        if str(device["ip"]) == local_ip:
            device["mac"] = get_mac_address()

        device["hostname"] = resolve_hostname(device["ip"])

    return devices