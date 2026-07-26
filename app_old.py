import system
import network
import lan_discovery
import ipaddress
import port_scanner
import service_detection
import utils

import subprocess

hostname = system.get_hostname() ; # print(f"Hostname: {hostname}")
username = system.get_username() ; # print(f"Username: {username}")
os = system.get_os_info() ; # print(f"OS: {os}")
architecture = system.get_machine_architecture() ; # print(f"Architecture: {architecture}")
processor = system.get_processor_name() ; # print(f"Processor: {processor}")
cpu_usage = system.get_cpu_usage() ; # print(f"CPU Usage: {cpu_usage}%")
memory_info = system.get_memory_info() ; # print(f"Memory Info: {memory_info.available}")
disk_info = system.get_disk_info() ; # print(f"Disk Info: {disk_info[1]}")
boot_time = system.get_boot_time() ; # print(f"Boot Time: {boot_time}")
uptime = system.get_uptime() ; # print(f"Uptime: {uptime}")

interfaces = network.get_interfaces() ; # print(f"Interfaces: {interfaces}")
active_interface = network.get_active_interface() ; # print(f"Active Interface: {active_interface}")
gateway = network.get_default_gateway() ; # print(f"Default Gateway: {gateway}")
public_ip = network.get_public_ip() ; # print(f"Public IP: {public_ip}")
network_address = network.get_network() ; # print(f"Network Address: {network_address}")

# print(f'Is google alive? { lan_discovery.ping_host("8.8.8.8") }') ; print(f'Is 192.0.2.1 alive? { lan_discovery.ping_host("192.0.2.1") }')
# print(f'Ping sweep of {network_address}: { lan_discovery.ping_sweep("8.8.8.8/24") }')
# print(f'ARP scan of {network_address}: { lan_discovery.arp_scan("192.168.1.1/24")}')
# print(f'MAC address of 192.168.1.1: {lan_discovery.get_mac("8.8.8.8")}')
# print(f'Hostname of 192.168.1.1: {lan_discovery.resolve_hostname("192.168.1.9")}')
# print(f'Devices = {lan_discovery.discover_devices("192.168.1.1/24")}')
# print(f'Port scan of 192.168.1.1: {port_scanner.scan_ports(network.get_ipv4(), [80, 6974])}')
# print(f'Top ports of 192.168.1.1: {port_scanner.scan_top_ports(network.get_ipv4())}')
# print(f'All ports of 192.168.1.1: {port_scanner.scan_all_ports(network.get_ipv4())}')
# print(f'Network scan of {network_address}: {port_scanner.scan_network(lan_discovery.discover_devices(network_address))}')
# print(f'Service detection of 192.168.1.1: {service_detection.detect_services(network.get_ipv4(), [80, 443])}')
# print(f'Service detection of 192.168.1.1 port 80: {service_detection.detect_service(network.get_ipv4(), 80)}')
# device = {
#     "ip": "8.8.8.8",
#     "ports": port_scanner.scan_top_ports("8.8.8.8")
# }
# print(f'Host services of 192.168.1.1: {service_detection.detect_host_services(device)}')

# print(f'Grab Banner: {service_detection.grab_banner("127.0.0.1", 22)}')
# print(f'HTTP Server Info: {service_detection.detect_http_server("127.0.0.1")}')

devices = [
    {"IP": "192.168.1.1", "Hostname": "Router"},
    {"IP": "192.168.1.9", "Hostname": "praneel"}
]

utils.print_table(port_scanner.scan_top_ports(network.get_ipv4()))