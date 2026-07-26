This project utilizes uv system
Install a package by `uv pip install <package_name>`

PROJECT NAME: PORTATLAS


Source of truth functions are in the following files:
    1. system.py
    2. port_scanner.py
    3. lan_discovery.py
    4. service_detection.py
    5. network.py
    6. utils.py

Source of truth functions may only and only be changed if it makes the scanning faster / stealthier. In short unless its a big performance benefit do not touch these files.

NMap is the heart and soul of the app. Use nmap if possible and cleaner implementation.

DO NOT EDIT CLAUDE.MD AT ALL. ALL YOUR SUGGESTIONS MUST GO INTO THE SUGGESTIONS.MD FILE.