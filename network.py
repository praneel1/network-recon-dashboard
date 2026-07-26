import psutil
import socket
import platform
import requests
import subprocess
import ipaddress

def get_interfaces():
    return list(psutil.net_if_addrs().keys())

def get_active_interface():
    interface_stats = psutil.net_if_stats()
    interface_addresses = psutil.net_if_addrs()

    for interface_name, addresses in interface_addresses.items():
        if not interface_stats[interface_name].isup:
            continue

        for address in addresses:
            if (address.family == socket.AF_INET and address.address != "127.0.0.1"):
                return interface_name

    return None

def _get_addresses():
    active_interface = get_active_interface()

    if active_interface is None:
        return []

    return psutil.net_if_addrs()[active_interface]

def get_ipv4():
    for address in _get_addresses():
        if address.family == socket.AF_INET:
            return address.address

    return None

def get_ipv6():
    ipv6_addresses = []

    for address in _get_addresses():
        if address.family == socket.AF_INET6:
            ipv6_addresses.append(address.address.split("%")[0])

    return ipv6_addresses

def get_mac_address():
    for address in _get_addresses():
        if address.family == psutil.AF_LINK:
            return address.address

    return None

def get_subnet_mask():
    for address in _get_addresses():
        if address.family == socket.AF_INET:
            return address.netmask

    return None

def get_default_gateway():
    if platform.system() != "Windows":
        raise NotImplementedError("Only Windows is currently supported.")

    result = subprocess.run(
        ["route", "print", "-4"],
        capture_output=True,
        text=True,
        check=True
    )

    for line in result.stdout.splitlines():
        parts = line.split()

        if len(parts) >= 5 and parts[0] == "0.0.0.0" and parts[1] == "0.0.0.0":
            return parts[2]

    return None

def get_public_ip():
    try:
        response = requests.get(
            "https://api.ipify.org",
            timeout=5
        )

        response.raise_for_status()

        return response.text

    except requests.RequestException:
        return None
    
def get_network():
    ipv4 = get_ipv4()
    subnet_mask = get_subnet_mask()

    if ipv4 is None or subnet_mask is None:
        return None

    return str(ipaddress.IPv4Network(
        f"{ipv4}/{subnet_mask}",
        strict=False
    ))