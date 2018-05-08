'use strict';

const { Client } = require('tplink-smarthome-api');
const prom_client = require('prom-client');
const express = require('express');
const server = express();
const register = prom_client.register;

const client = new Client();
const Gauge = prom_client.Gauge;

function gauge_helper(device, name, help)
{
    name = 'tplink_' + name;
    var gauge = register.getSingleMetric(name);
    if(gauge == null)
    {
      gauge = new Gauge({
          name: name,
          help: help,
          labelNames: ['alias', 'model', 'host']
      });
    }
    
    return gauge.labels(
        device.sysInfo.alias,
        device.model,
        device.host);
}

// Look for devices, log to console, and turn them on
client.startDiscovery().on('device-new', (device) => {
  device.getSysInfo().then(() =>
{
    var gauge = register.getSingleMetric('tplink_device');
    if(gauge == null)
    {
      gauge = new Gauge({
          name: 'tplink_device',
          help: 'Raw technical tplink device details, metric = sys_info.err_code',
          labelNames: ['type', 'host', 'mac', 'deviceId', 'hwId', 'sw_ver', 'hw_ver']
      });
    }
    
    gauge.labels(
        device.sysInfo.type,
        device.host,
      device.sysInfo.mac,
      device.sysInfo.deviceId,
      device.sysInfo.hwId,
      device.sysInfo.sw_ver,
      device.sysInfo.hw_ver).set(device.sysInfo.err_code);

    
});
  
/*
  these don't seem any better than just polling relay_state directly
  device.on('power-on', () => {
     gauge_helper(device, 'power_on', 'Device is powered up').set(1); 
  });

  device.on('power-off', () => {
     gauge_helper(device, 'power_on', 'Device is powered up').set(0); 
 }); */

  // https://stackoverflow.com/questions/6685396/execute-the-setinterval-function-without-delay-the-first-time
  // suggests setInterval shouldn't be used, but for now I will risk it
  setInterval(() => {
      
      device.getSysInfo().then((sys_info) => {
          gauge_helper(device, 'relay_state', 'Relay State').
            set(sys_info.relay_state);
          gauge_helper(device, 'rssi', "RSSI WiFi strength").
            set(sys_info.rssi);
          gauge_helper(device, 'on_time', 'Amount of time device has been on in seconds').
            set(sys_info.on_time);
      });
      
      device.emeter.getRealtime().then((emeter) => {
          gauge_helper(device, 'emeter_power', 'Watts being consumed').
            set(emeter.power);
      });

  }, 2000);
  
  setInterval(() => {
      
      device.cloud.getInfo().then((cloud_info) => {
          gauge_helper(device, 'cloud_binded', 'Cloud presence').
            set(cloud_info.binded);

      });
      
  }, 60000);
});

server.get('/metrics', (req, res) => {
	res.set('Content-Type', register.contentType);
	res.end(register.metrics());
});

console.log('Server listening to 3000, metrics exposed on /metrics endpoint');
server.listen(3000);
