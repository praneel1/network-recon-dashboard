from system import *
from network import *
from lan_discovery import *
from port_scanner import *
from service_detection import *
from utils import print_table


def main():
    print("=" * 60)
    print("SYSTEM INFORMATION")
    print("=" * 60)

    print("Hostname:", get_hostname())
    print("Username:", get_username())
    print("OS Info:", get_os_info())
    print("Architecture:", get_machine_architecture())
    print("Processor:", get_processor_name())
    print("CPU Usage:", f"{get_cpu_usage()} %")
    print("Memory:", get_memory_info())

    print("\nDisk Information")
    print_table(get_disk_info())

    print("\nBoot Time:", get_boot_time())
    print("Uptime:", get_uptime())

    print("\n" + "=" * 60)
    print("NETWORK INFORMATION")
    print("=" * 60)

    print("Interfaces:", get_interfaces())
    print("Active Interface:", get_active_interface())
    print("IPv4:", get_ipv4())
    print("IPv6:", get_ipv6())
    print("MAC Address:", get_mac_address())
    print("Subnet Mask:", get_subnet_mask())

    try:
        print("Default Gateway:", get_default_gateway())
    except Exception as error:
        print("Default Gateway:", error)

    print("Public IP:", get_public_ip())
    print("Network:", get_network())

    network = get_network()

    if network is None:
        print("\nNo active network found.")
        return

    print("\n" + "=" * 60)
    print("PING SWEEP")
    print("=" * 60)

    alive_hosts = ping_sweep(network)

    if alive_hosts:
        for host in alive_hosts:
            print(host)
    else:
        print("No alive hosts found.")

    if alive_hosts:
        print("\nPinging first alive host...")
        print(ping_host(alive_hosts[0]))

    print("\n" + "=" * 60)
    print("ARP SCAN")
    print("=" * 60)

    arp_devices = arp_scan(network)

    if arp_devices:
        print_table(arp_devices)
    else:
        print("No devices found.")

    print("\n" + "=" * 60)
    print("DEVICE DISCOVERY")
    print("=" * 60)

    devices = discover_devices(network)

    if devices:
        print_table(devices)
    else:
        print("No devices discovered.")
        return

    first_device = devices[0]

    print("\n" + "=" * 60)
    print("HOSTNAME RESOLUTION")
    print("=" * 60)

    print(resolve_hostname(first_device["ip"]))

    print("\n" + "=" * 60)
    print("MAC LOOKUP")
    print("=" * 60)

    print(get_mac(first_device["ip"]))

    print("\n" + "=" * 60)
    print("COMMON PORT SCAN")
    print("=" * 60)

    common_ports = [
        21, 22, 23, 25,
        53, 80, 110, 135,
        139, 143, 443,
        445, 3389
    ]

    common_scan = scan_ports(first_device["ip"], common_ports)
    print_table(common_scan)

    print("\nSingle Port Scan (80)")
    print(scan_port(first_device["ip"], 80))

    print("\n" + "=" * 60)
    print("TOP 1000 PORT SCAN")
    print("=" * 60)

    top_ports = scan_top_ports(first_device["ip"])

    if top_ports:
        print_table(top_ports)
    else:
        print("No open ports found.")

    print("\n" + "=" * 60)
    print("NETWORK PORT SCAN")
    print("=" * 60)

    scanned_devices = scan_network(devices)

    for device in scanned_devices:
        print(f"\nDevice: {device['ip']}")
        print(f"Hostname: {device['hostname']}")
        print(f"MAC: {device['mac']}")

        if device["ports"]:
            print_table(device["ports"])
        else:
            print("No ports found.")

    print("\n" + "=" * 60)
    print("HOST SERVICE DETECTION")
    print("=" * 60)

    enriched_device = detect_host_services(scanned_devices[0])

    print(f"Device: {enriched_device['ip']}")
    print(f"Hostname: {enriched_device['hostname']}")
    print(f"MAC: {enriched_device['mac']}")

    if enriched_device["ports"]:
        print_table(enriched_device["ports"])
    else:
        print("No services detected.")

    print("\n" + "=" * 60)
    print("NETWORK SERVICE DETECTION")
    print("=" * 60)

    network_services = detect_network_services(scanned_devices)

    for device in network_services:
        print(f"\nDevice: {device['ip']}")
        print(f"Hostname: {device['hostname']}")
        print(f"MAC: {device['mac']}")

        if device["ports"]:
            print_table(device["ports"])
        else:
            print("No services detected.")

    open_ports = [
        port["port"]
        for port in scanned_devices[0]["ports"]
        if port["state"] == "open"
    ]

    if open_ports:
        print("\n" + "=" * 60)
        print("SINGLE SERVICE DETECTION")
        print("=" * 60)

        print(detect_service(scanned_devices[0]["ip"], open_ports[0]))

        print("\n" + "=" * 60)
        print("MULTIPLE SERVICE DETECTION")
        print("=" * 60)

        print_table(
            detect_services(
                scanned_devices[0]["ip"],
                open_ports
            )
        )

        print("\n" + "=" * 60)
        print("BANNER GRAB")
        print("=" * 60)

        print(
            grab_banner(
                scanned_devices[0]["ip"],
                open_ports[0]
            )
        )

        print("\n" + "=" * 60)
        print("HTTP SERVER DETECTION")
        print("=" * 60)

        print(
            detect_http_server(
                scanned_devices[0]["ip"]
            )
        )

    # Uncomment if you want to scan every port (takes a long time)
    #
    # print("\n" + "=" * 60)
    # print("ALL PORT SCAN")
    # print("=" * 60)
    # print_table(scan_all_ports(first_device["ip"]))


if __name__ == "__main__":
    main()