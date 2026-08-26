# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [
    ("templates", "templates"),
    ("static", "static"),
    ("nmap", "nmap"),
]
binaries = []
hiddenimports = [
    "system",
    "network",
    "lan_discovery",
    "port_scanner",
    "service_detection",
    "utils",
    "flask",
    "jinja2",
    "werkzeug",
    "markupsafe",
    "itsdangerous",
    "click",
    "psutil",
    "nmap",
    "icmplib",
    "requests",
    "urllib3",
    "certifi",
    "idna",
    "charset_normalizer",
    "tabulate",
]

for pkg in ("flask", "jinja2", "werkzeug", "nmap", "icmplib", "requests", "certifi"):
    try:
        collected_datas, collected_binaries, collected_hidden = collect_all(pkg)
        datas += collected_datas
        binaries += collected_binaries
        hiddenimports += collected_hidden
    except Exception:
        pass

a = Analysis(
    ["app.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["gunicorn"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
