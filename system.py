import getpass
import socket
import platform
import psutil
import datetime

def get_hostname():
    return socket.gethostname()

def get_username():
    return getpass.getuser()

def get_os_info():
    return platform.system(), platform.version()

def get_machine_architecture():
    return platform.machine()

def get_processor_name():
    return platform.processor()

def get_cpu_usage():
    return psutil.cpu_percent(interval=1)

def get_memory_info():
    memory = psutil.virtual_memory()

    return {
        "total": memory.total,
        "available": memory.available,
        "used": memory.used,
        "free": memory.free,
        "percent": memory.percent
    }

def get_disk_info():
    disks = []

    for partition in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(partition.mountpoint)

            disks.append({
                "device": partition.device,
                "mountpoint": partition.mountpoint,
                "filesystem": partition.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percentage": usage.percent
            })

        except PermissionError:
            continue

    return disks

def get_boot_time():
    return datetime.datetime.fromtimestamp(
        psutil.boot_time()
    ).isoformat()

def get_uptime():
    boot_time = datetime.datetime.fromtimestamp(
        psutil.boot_time()
    )

    return str(datetime.datetime.now() - boot_time)