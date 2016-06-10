## Make Homey a controller for Mysensors.org
This app will make Homey a controller for Mysensors.org

### Supported gateway types
* [MQTT Gateway](https://www.mysensors.org/build/mqtt_gateway)
* [Ethernet Gateway](https://www.mysensors.org/build/ethernet_gateway)

### Connect to your gateway.
##### Settings
Add the connection details in the settingspage to connect to your gateway.
![Settings](http://homey.morewi.se/mysensors/mysensors_app_settings.png)
![MQTT](http://homey.morewi.se/mysensors/mysensors_app_settings_mqtt.png)
![Ethernet](http://homey.morewi.se/mysensors/mysensors_app_settings_ethernet.png)

### Add a device (sensor)
You can only add a device (sensor) after the sensor have sent a presentation or set message.

You will get a list of the sensors you have not added yet.
![Settings](http://homey.morewi.se/mysensors/mysensors_app_adddevice_1.png)

Click on the sensor you will add in the list.
![Settings](http://homey.morewi.se/mysensors/mysensors_app_adddevice_2.png)

You can then set a new name and you need to choose why type of sensor it is (device type) and witch capability it will have.
It is Homey that need to know the device type and capability to be able to present the device correct.
![Settings](http://homey.morewi.se/mysensors/mysensors_app_adddevice_3.png)

This is because the user can use the same sensor type to diffrent things.
ex. V_TRIPPED can be use as Door and window sensors, Motion sensors and Smoke sensor and some other.

### Flows
You can use your device in flows.

##### Triggers
- Value has changed: Is trigged when a new value is set
    - token 'Value': is the current value

- Value is On: Is trigged if the device type is a on/off type and when the value is true
    - token 'Value': is the current value

- Value is Off: Is trigged if the device type is a on/off type and when the value is false
    - token 'Value': is the current value

##### Conditions
- Value is...: Check if the current value is a specific value

- On / Off: Check if the current value is true or false

##### Actions
The following actions are available:
- Set text
    
- Set number
    
- On / Off
    You can set the value to on/off

### Version history
* 0.1.0 App store release

### Donate
This is an open source application and totaly free. 
If you still want to make a donation I can build more sensors to use in the app.

[![](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CGEGVFND9E532)
