# homebridge-emotiva-mc700
Emotiva MC-700 receiver plugin for homebridge: https://github.com/nfarina/homebridge
This plugin communicates with Emotiva receiver using rs-232 An usb to serial rs232 converter from [FTDI](https://www.ftdichip.com/Products/Cables/USBRS232.htm) is recommended. Cheaper converters may not function correctly.  
The code in this repository has been forked from [rooi/homebridge-marantz-rs232](https://github.com/rooi/homebridge-marantz-rs232)

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-emotiva-mc700
3. Update your configuration file. See the sample below.

# Configuration

Configuration sample:

 ```
"accessories": [
    {
        "accessory": "Emotiva-MC700",
        "name": "Receiver",
        "path": "/dev/cu.usbserial-FTH7QVHK",
        "maxVolume": 800,
        "minVolume": 000,
    }
]
```

