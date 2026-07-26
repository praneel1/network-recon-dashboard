import ipaddress
import time
from functools import wraps
from tabulate import tabulate

def validate_ip(ip):
    try:
        return ipaddress.ip_address(ip)
    except ValueError:
        return None

def validate_port(port):
    if not isinstance(port, int):
        return False

    return 1 <= port <= 65535


def cidr_to_hosts(network):
    return list(
        ipaddress.ip_network(network).hosts()
    )


def time_function(function):

    @wraps(function)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()

        result = function(*args, **kwargs)

        end = time.perf_counter()

        print(
            f"{function.__name__} took {end - start:.4f} seconds"
        )

        return result

    return wrapper


def print_table(data):
    print(
        tabulate(
            data,
            headers="keys",
            tablefmt="grid"
        )
    )