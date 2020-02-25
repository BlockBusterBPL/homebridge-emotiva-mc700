# homebridge-emotiva-mc700
Emotiva MC-700 receiver plugin for homebridge: https://github.com/nfarina/homebridge
This plugin communicates with Emotiva receiver using rs-232. A usb to serial rs232 converter from [FTDI](https://www.ftdichip.com/Products/Cables/USBRS232.htm) is recommended. Cheaper converters may not function correctly, and have not been tested. Please note that the Emotiva unit has a female DB-9 connector for serial, so make sure you have an adapter or cable to connect your unit to your serial adapter.  
  
The code in this repository has been forked from [rooi/homebridge-marantz-rs232](https://github.com/rooi/homebridge-marantz-rs232)

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-emotiva-mc700
3. Update your configuration file. See the sample below.

# Configuration

Configuration sample:

 ```json
"accessories": [
    {
        "accessory": "Emotiva-MC700",
        "name": "Receiver",
        "path": "/dev/tty.usbserial-1410",
        "maxVolume": 800,
        "minVolume": 000,
    }
]
```

