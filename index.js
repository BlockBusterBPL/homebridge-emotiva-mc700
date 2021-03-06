// Accessory for controlling an Emotiva MC-700 via HomeKit

var inherits = require('util').inherits;
var SerialPort = require("serialport");
var Service, Characteristic;

// Use a `\r\n` as a line terminator
const parser = new SerialPort.parsers.Readline({
                                    delimiter: '\r'
                                    });

// need to be global to be used in constructor
var maxVolume;
var minVolume;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    
    homebridge.registerAccessory("homebridge-emotiva-mc700", "Emotiva-MC700", EmotivaMC700);
    
    
    function EmotivaMC700(log, config) {
        // configuration
        this.name = config['name'];
        this.path = config['path'];
        maxVolume = config['maxVolume'];
        minVolume = config['minVolume'];
        
        this.timeout = config.timeout || 1000;
        this.queue = [];
        this.callbackQueue = [];
        this.ready = true;
        
        this.log = log;
        
        this.volume = minVolume;
        
        this.serialPort = new SerialPort(this.path, {
                                         baudRate: 9600,
                                         autoOpen: false
                                         }); // this is the openImmediately flag [default is true]
        
        this.serialPort.pipe(parser);
        
        parser.on('data', function(data) {
                           
                           this.log("Received data: " + data);
                           this.serialPort.close(function(error) {
                                this.log("Closing connection");
                                if(error) this.log("Error when closing connection: " + error)
                                var callback;
                                if(this.callbackQueue.length) callback = this.callbackQueue.shift()
                                    if(callback) callback(data,0);
                                }.bind(this)); // close after response
                           }.bind(this));
    }
    
    // Custom Characteristics and service...
    EmotivaMC700.AudioVolume = function() {
        Characteristic.call(this, 'Volume', '00001001-0000-1000-8000-135D67EC4377');
        this.log("Maximum Volume", maxVolume);
        this.setProps({
                      format: Characteristic.Formats.FLOAT,
                      maxValue: maxVolume,
                      minValue: minVolume,
                      minStep: 0.5,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        this.value = this.getDefaultValue();
    };
    inherits(EmotivaMC700.AudioVolume, Characteristic);
    
    EmotivaMC700.Muting = function() {
        Characteristic.call(this, 'Mute', '00001002-0000-1000-8000-135D67EC4377');
        this.setProps({
                      format: Characteristic.Formats.BOOL,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        this.value = this.getDefaultValue();
    };
    inherits(EmotivaMC700.Muting, Characteristic);
    
    EmotivaMC700.AudioDeviceService = function(displayName, subtype) {
        Service.call(this, displayName, '00000001-0000-1000-8000-135D67EC4377', subtype);
        this.addCharacteristic(MarantzAVR.AudioVolume);
        this.addCharacteristic(MarantzAVR.Muting);
    };
    inherits(EmotivaMC700.AudioDeviceService, Service);
    
    EmotivaMC700.prototype = {
        
    send: function(cmd, callback) {
        this.sendCommand(cmd, callback);
        //if (callback) callback();
    },
        
    exec: function() {
        // Check if the queue has a reasonable size
        if(this.queue.length > 100) {
            this.queue.clear();
            this.callbackQueue.clear();
        }
        
        this.queue.push(arguments);
        this.process();
    },
        
    sendCommand: function(command, callback) {
        this.log("serialPort.open");
        if(this.serialPort.isOpen){
            this.log("serialPort is already open...");
            if(callback) callback(0,1);
        }
        else{
            this.serialPort.open(function (error) {
                             if(error) {
                                this.log("Error when opening serialport: " + error);
                                if(callback) callback(0,error);
                             }
                             else {
                                 if(callback) this.callbackQueue.push(callback);
                                 this.serialPort.write(command, function(err) {
                                                   if(err) this.log("Write error = " + err);
                                                   //this.serialPort.drain();
                                                   }.bind(this));
                             }
                             //            if(callback) callback(0,0);
                             }.bind(this));
        }
    },
        
    process: function() {
        if (this.queue.length === 0) return;
        if (!this.ready) return;
        var self = this;
        this.ready = false;
        this.send.apply(this, this.queue.shift());
        
        setTimeout(function () {
                   self.ready = true;
                   self.process();
                   }, this.timeout);
    },
        
    getPowerState: function(callback) {
        var cmd = "@PWR:?\r";
        
        this.log("getPowerState");
        
        this.exec(cmd, function(response,error) {
                  
                  this.log("Power state is: " + response);
                  if (response && response.indexOf("@PWR:2") > -1) {
                  if(callback) callback(null, true);
                  }
                  else {
                  if(callback) callback(null, false);
                  }
                  }.bind(this))
        
    },
        
    setPowerState: function(powerOn, callback) {
        var cmd;
        
        if (powerOn) {
            cmd = "@112\r";
            this.log("Set", this.name, "to on");
        }
        else {
            cmd = "@113\r";
            this.log("Set", this.name, "to off");
        }

        this.exec(cmd, function(response,error) {
                  if (error) {
                  this.log('Serial power function failed: %s');
                  if(callback) callback(error);
                  }
                  else {
                  this.log('Serial power function succeeded!');
                  if(callback) callback();
                  }
                  }.bind(this));
    },
        
    getMuteState: function(callback) {
        var cmd = "@AMT:?\r";
        
        this.exec(cmd, function(response, error) {
                  
                  this.log("Mute state is:", response);
                  if (response && response.indexOf("@ATT:2") > -1) {
                  callback(null, true);
                  }
                  else {
                  callback(null, false);
                  }
                  }.bind(this))
        
    },
        
    setMuteState: function(muteOn, callback) {
        var cmd;
        
        if (muteOn) {
            cmd = "@11Q\r";
            this.log(this.name, "muted");
        }
        else {
            cmd = "@11R\r";
            this.log(this.name, "unmuted");
        }
        
        this.exec(cmd, function(response, error) {
                  if (error) {
                  this.log('Serial mute function failed: %s');
                  callback(error);
                  }
                  else {
                  this.log('Serial mute function succeeded!');
                  callback();
                  }
                  }.bind(this));
    },
        
    dbToPercentage: function(db) {
        this.log("dbToPercentage");
        var minMaxDiff = maxVolume - minVolume;
        this.log("db = " + db);
        var percentage = 100.0 * (db - minVolume) / minMaxDiff;
        this.log("percentage = " + percentage);
        return percentage;
    },
        
    percentageToDb: function(percentage) {
        this.log("percentageToDb");
        var minMaxDiff = maxVolume - minVolume;
        this.log("percentage = " + percentage);
        var db = 0.01 * percentage * minMaxDiff + minVolume;
        if(db > maxVolume) db = maxVolume;
        if(db < minVolume) db = minVolume;
        this.log("db = " + db);
        return db;
    },
        
    getVolume: function(callback) {
        var cmd = "@VOL:?\r";
        
        this.exec(cmd, function(response, error) {
                  
            //VOL:xxxy(xxx)
            if(response && response.indexOf("@VOL:") > -1) {
                  var vol = 0;
                  if(response.indexOf("+") > -1) {
                    //console.log("+");
                    vol = response.substring(6,8);
                  }
                  else {
                    //console.log("-");
                    vol = response.substring(5,8);
                  }
                  this.volume = this.dbToPercentage(Number(vol));
                  //console.log("this.volume=" + this.volume);
                  callback(null, Number(this.volume));
            }
            else callback(null,0);
        }.bind(this))
    },
        
    setVolume: function(value, callback) {
        
        var db = this.percentageToDb(value);
        if(this.volume != value) {
            this.volume = value;
            var cmd = "11P";
            cmd = cmd + parseInt(db*10.0);
            cmd = cmd + "\r";
            
            this.exec(cmd, function(response, error) {
                      if (error) {
                      this.log('Serial volume function failed: %s');
                      callback(error);
                      }
                      else {
                      this.log("Set volume to", db, "db");
                      callback();
                      }
                      }.bind(this));
        }
        else {
            this.log("Volume has not changed");
            callback();
        }
    },

    getVolumeUpState: function(callback) {
        callback(null, 0);
    },

    getVolumeDownState: function(callback) {
        callback(null, 0);
    },
        
    getVolumeUpFastState: function(callback) {
        callback(null, 0);
    },
        
    getVolumeDownFastState: function(callback) {
        callback(null, 0);
    },
        
    setVolumeUpState: function(value, callback) {
        
        var cmd = "@11S\r";
        
        var signedValue = value;
        this.setVolumeState(cmd, signedValue, callback);
        
        var targetChar = this.speakerService.getCharacteristic(VolumeUpCharacteristic);
        if(value > 0) setTimeout(function(){targetChar.setValue(false);}, 300);
    },
        
    setVolumeDownState: function(value, callback) {
        
        var cmd = "@11R\r";
        
        var signedValue = -1 * value;
        this.setVolumeState(cmd, signedValue, callback);
        
        var targetChar = this.speakerService.getCharacteristic(VolumeDownCharacteristic);
        if(value > 0) setTimeout(function(){targetChar.setValue(false);}, 300);
    },

    setVolumeUpFastState: function(value, callback) {
        
        var cmd = "@11S\r";
        
        var signedValue = value;
        this.setVolumeState(cmd, signedValue, callback);
        
        var targetChar = this.speakerService.getCharacteristic(VolumeUpFastCharacteristic);
        if(value > 0) setTimeout(function(){targetChar.setValue(false);}, 300);
    },
        
    setVolumeDownFastState: function(value, callback) {
        
        var cmd = "@11R\r";
        
        var signedValue = -1 * value;
        this.setVolumeState(cmd, signedValue, callback);
        
        var targetChar = this.speakerService.getCharacteristic(VolumeDownFastCharacteristic);
        if(value > 0) setTimeout(function(){targetChar.setValue(false);}, 300);
    },
        
    setVolumeState: function(cmd, value, callback) {
        
        if(value == 0) {
            this.log("Resetting volume up/down button");
            callback();
        }
        else if(value > 0 && this.volume >= 100) {
            this.log("Maximum volume reached");
            callback(); // limit the volume
        }
        else if(value < 0 && this.volume <= 0) {
            this.log("Minumum volume reached");
            callback(); // limit the volume
        }
        else {
            this.log('Executing: ' + cmd);
            
            this.exec(cmd, function(response, error) {
                if (error) {
                    this.log('Serial increase volume function failed: ' + error);
                    callback(error);
                }
                else {
                    this.log("Changing volume");
                    var targetCharVol = this.speakerService.getCharacteristic(Characteristic.Volume);

                    targetCharVol.getValue(null);
                    callback();
                }
            }.bind(this));
        }
    },

    toggleTestTone: function(callback) {
        
        var cmd = "@TTO:0\r";
        
        this.exec(cmd); // send without callback
        
        cmd = "@VOL:?\r"; // get confirmation with callback
        
        this.exec(cmd, function(response, error) {
                  if (error) {
                  this.log('Serial volume function failed: %s');
                  if(callback) callback(error);
                  }
                  else {
                  this.log("Toggle test tone");
                  if(callback) callback();
                  }
                  }.bind(this));
    },
        
    getSourcePort: function(callback) {
        var cmd = "@SRC:?\r";
        
        this.exec(cmd, function(response, error) {

            //SRC:xx
            if(response && response.indexOf("@SRC:") > -1) {
                  
                  var src = response.substring(6,7);
                
                  var srcNr = 0;
                  if(src == 'A') srcNr = 10;
                  else if(src == 'B') srcNr = 11;
                  else if(src == 'C') srcNr = 12;
                  else if(src == 'D') srcNr = 13;
                  else if(src == 'E') srcNr = 14;
                  else if(src == 'F') srcNr = 15;
                  else if(src == 'G') srcNr = 16;
                  else if(src == 'H') srcNr = 17;
                  else if(src == 'I') srcNr = 18;
                  else if(src == 'J') srcNr = 19;
                  else if(src == 'K') srcNr = 20;
                  else if(src == 'L') srcNr = 21;
                  else if(src == 'M') srcNr = 22;
                  else if(src == 'N') srcNr = 23;
                  else srcNr = Number(src);

                  //console.log("src =" + src + " srcNr = " + srcNr);
                  callback(null, srcNr);
            }
            else callback(null,0);
        }.bind(this))
    },
        
    setSourcePort: function(port, callback) {
        var cmd = "@";
        
        if (port < 10) cmd = cmd + port + "\r";
        else if(port == 10) cmd = cmd + '11B' + "\r";
        else if(port == 11) cmd = cmd + '116' + "\r";
        else if(port == 12) cmd = cmd + '115' + "\r";
        else if(port == 13) cmd = cmd + '15A' + "\r";
        else if(port == 14) cmd = cmd + '15B' + "\r";
        else if(port == 15) cmd = cmd + '15C' + "\r";
        else if(port == 16) cmd = cmd + '15D' + "\r";
        else if(port == 17) cmd = cmd + '117' + "\r";
        else if(port == 18) cmd = cmd + '15E' + "\r";
        else if(port == 19) cmd = cmd + '15F' + "\r";
        else if(port == 20) cmd = cmd + '15G' + "\r";
        else if(port == 21) cmd = cmd + '15H' + "\r";
        else cmd = cmd + 0 + "\r";
        
        this.exec(cmd, function(response, error) {
            if (error) {
                this.log('Set Source function failed: ' + error);
                callback(error);
            }
            else {
                this.log('Set Source function succeeded!');
                callback();
            }
        }.bind(this));
    },
        
    identify: function(callback) {
        this.log("Identify requested!");
        
        this.setPowerState(true); // turn on
        this.toggleTestTone();
        this.toggleTestTone(callback);
        
        if(callback) callback();
    },
        
    getServices: function() {
        var that = this;
        
        var informationService = new Service.AccessoryInformation();
        informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, "Emotiva")
        .setCharacteristic(Characteristic.Model, "MC-700")
        .setCharacteristic(Characteristic.SerialNumber, "1234567890");
        
        var switchService = new Service.Switch("Power State", "power_on");
        switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
        
        makeHSourceCharacteristic();
        
        switchService
        .addCharacteristic(SourceCharacteristic)
        .on('get', this.getSourcePort.bind(this))
        .on('set', this.setSourcePort.bind(this));
        
        var speakerService = new Service.Speaker("Speaker");
        speakerService
        .getCharacteristic(Characteristic.Mute)
        .on('get', this.getMuteState.bind(this))
        .on('set', this.setMuteState.bind(this));

        speakerService
        .getCharacteristic(Characteristic.Volume)
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));
        
        makeHVolumeControlCharacteristic(homebridge);
        
        speakerService
        .addCharacteristic(VolumeUpCharacteristic)
        .on('get', this.getVolumeUpState.bind(this))
        .on('set', this.setVolumeUpState.bind(this));

        speakerService
        .addCharacteristic(VolumeDownCharacteristic)
        .on('get', this.getVolumeDownState.bind(this))
        .on('set', this.setVolumeDownState.bind(this));
        
        speakerService
        .addCharacteristic(VolumeUpFastCharacteristic)
        .on('get', this.getVolumeUpFastState.bind(this))
        .on('set', this.setVolumeUpFastState.bind(this));
        
        speakerService
        .addCharacteristic(VolumeDownFastCharacteristic)
        .on('get', this.getVolumeDownFastState.bind(this))
        .on('set', this.setVolumeDownFastState.bind(this));
        
        this.speakerService = speakerService;
        
        return [informationService, switchService, speakerService];
    }
    }
};

function makeHSourceCharacteristic() {
    
    SourceCharacteristic = function () {
        Characteristic.call(this, 'Source', '212131F4-2E14-4FF4-AE13-C97C3232499E');
        this.setProps({
                      format: Characteristic.Formats.INT,
                      unit: Characteristic.Units.NONE,
                      maxValue: 23,
                      minValue: 0,
                      minStep: 1,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        //this.eventEnabled = true;
        this.value = this.getDefaultValue();
    };
    
    inherits(SourceCharacteristic, Characteristic);
}

function makeHVolumeControlCharacteristic(homebridge) {
    
    UUID = homebridge.hap.uuid;
    
    VolumeUpCharacteristic = function () {
        var serviceUUID = UUID.generate('EmotivaMC700Types:VolumeControl:VolumeUp');
        Characteristic.call(this, 'Volume Up', serviceUUID);
        this.setProps({
                      format: Characteristic.Formats.BOOL,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        //this.eventEnabled = true;
        this.value = this.getDefaultValue();
    };
    
    inherits(VolumeUpCharacteristic, Characteristic);
    
    VolumeDownCharacteristic = function () {
        var serviceUUID = UUID.generate('EmotivaMC700Types:VolumeControl:VolumeDown');
        Characteristic.call(this, 'Volume Down', serviceUUID);
        this.setProps({
                      format: Characteristic.Formats.BOOL,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        //this.eventEnabled = true;
        this.value = this.getDefaultValue();
    };
    
    inherits(VolumeDownCharacteristic, Characteristic);
    
    VolumeUpFastCharacteristic = function () {
        var serviceUUID = UUID.generate('EmotivaMC700Types:VolumeControl:VolumeUpFast');
        Characteristic.call(this, 'Volume Up Fast', serviceUUID);
        this.setProps({
                      format: Characteristic.Formats.BOOL,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        //this.eventEnabled = true;
        this.value = this.getDefaultValue();
    };
    
    inherits(VolumeUpFastCharacteristic, Characteristic);
    
    VolumeDownFastCharacteristic = function () {
        var serviceUUID = UUID.generate('EmotivaMC700Types:VolumeControl:VolumeDownFast');
        Characteristic.call(this, 'Volume Down Fast', serviceUUID);
        this.setProps({
                      format: Characteristic.Formats.BOOL,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        //this.eventEnabled = true;
        this.value = this.getDefaultValue();
    };
    
    inherits(VolumeDownFastCharacteristic, Characteristic);
}
