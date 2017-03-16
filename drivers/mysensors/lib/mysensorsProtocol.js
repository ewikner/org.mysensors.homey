exports.decodeMessage = function (messageStr,splitChar) {

    if (!messageStr) {
        return null;
    }
    console.log(messageStr);
    var messageArr = messageStr.split(splitChar);
    var debugStr = messageArr.join(';');
    if (!messageArr || messageArr.length !== 6) {
        console.log("decode err")
        console.log(messageStr)
        return null;
    }

    try {
        var messageType = this.types[messageArr[2]].value;
        var subType = messageType;
        if((messageType == 'req') || (messageType == 'set')) {
            subType = 'req_set';
        }

        if((subType == 'stream') && (messageArr[4] != 0)) {
            console.log("stream: "+messageStr);
            return null;
        }

        var messageObj = {
            nodeId: messageArr[0],
            sensorId: messageArr[1],
            messageType: messageType,
            ack: messageArr[3],
            subType: this[subType][messageArr[4]].value,
            payload: messageArr[5].replace('\n',''),
            direction: 'IN',
            debugObj: {t: new Date().getTime(), s: debugStr}
        };
    } catch (e) {
        console.log(e)
        console.log(messageStr);
        return null;
    }

    return messageObj;
};

exports.encodeMessage = function (messageObj,splitChar, gwType) {
    var encodedObj = [
        messageObj.nodeId,
        messageObj.sensorId
    ]
    this.types.forEach(function(item, index) {
        if(item.value == messageObj.messageType) {
            encodedObj.push(item.id);
        }
    });
    encodedObj.push(messageObj.ack);

    var messageType = messageObj.messageType;
    if((messageObj.messageType == 'req') || (messageObj.messageType == 'set')) {
        messageType = 'req_set';
    }
    this[messageType].forEach(function(item, index) {
        if(item.value == messageObj.subType) {
            encodedObj.push(item.id);
        }
    });
    var returnMessage = {};
    var debugStr = '';
    switch(messageObj.payload) {
        case true:
            messageObj.payload = '1';
            break;
        case false:
            messageObj.payload = '0';
            break;
    }
    if(gwType == 'mqtt') {
        returnMessage.message_str = encodedObj.join(splitChar);
        returnMessage.payload = ""+messageObj.payload;

        encodedObj.push(messageObj.payload);
        debugStr = encodedObj.join(';');
    } else {
        encodedObj.push(messageObj.payload);
        returnMessage = encodedObj.join(splitChar);
        debugStr = encodedObj.join(';');
    }
    
    messageObj.direction = 'OUT';
    messageObj.debugObj = {t: new Date().getTime(), s: debugStr};

    return {'messageObj': messageObj, 'returnMessage': returnMessage};
}

exports.getCapabilities = function(inputStr) {
    var capabilities = null;
    if(inputStr) {
        var firstChar = inputStr.charAt(0);

        if(firstChar == 'S') {
            this.presentation.forEach(function(item, index) {
                if(item.value == inputStr) {
                    if(item.variables.length > 0) {
                        inputStr = item.variables[0];
                    } else {
                        inputStr = null;
                    }
                }
                
            });
        }

        this.req_set.forEach(function(item, index) {
            if(item.value == inputStr) {
                if(item.capabilities.sub_type != '') {
                    capabilities = item.capabilities;
                }
            }
        });
    }
    return capabilities;
}

exports.types = [
    {'id': '0', 'value': 'presentation'},
    {'id': '1', 'value': 'set'},
    {'id': '2', 'value': 'req'},
    {'id': '3', 'value': 'internal'},
    {'id': '4', 'value': 'stream'}
];

exports.presentation = [
    {'id': '0', 'value': 'S_DOOR',                  'variables': ['V_TRIPPED', 'V_ARMED']},
    {'id': '1', 'value': 'S_MOTION',                'variables': ['V_TRIPPED', 'V_ARMED']},
    {'id': '2', 'value': 'S_SMOKE',                 'variables': ['V_TRIPPED', 'V_ARMED']},
    {'id': '3', 'value': 'S_BINARY',                'variables': ['V_STATUS', 'V_WATT']},
    {'id': '4', 'value': 'S_DIMMER',                'variables': ['V_STATUS', 'V_DIMMER', 'V_WATT']},
    {'id': '5', 'value': 'S_COVER',                 'variables': ['V_UP', 'V_DOWN', 'V_STOP', 'V_PERCENTAGE']},
    {'id': '6', 'value': 'S_TEMP',                  'variables': ['V_TEMP', 'V_ID']},
    {'id': '7', 'value': 'S_HUM',                   'variables': ['V_HUM']},
    {'id': '8', 'value': 'S_BARO',                  'variables': ['V_PRESSURE', 'V_FORECAST']},
    {'id': '9', 'value': 'S_WIND',                  'variables': ['V_WIND', 'V_GUST', 'V_DIRECTION']},
    {'id': '10', 'value': 'S_RAIN',                 'variables': ['V_RAIN', 'V_RAINRATE']},
    {'id': '11', 'value': 'S_UV',                   'variables': ['V_UV']},
    {'id': '12', 'value': 'S_WEIGHT',               'variables': ['V_WEIGHT', 'V_IMPEDANCE']},
    {'id': '13', 'value': 'S_POWER',                'variables': ['V_WATT', 'V_KWH', 'V_VAR', 'V_VA', 'V_POWER_FACTOR']},
    {'id': '14', 'value': 'S_HEATER',               'variables': ['V_HVAC_SETPOINT_HEAT', 'V_HVAC_FLOW_STATE', 'V_TEMP', 'V_STATUS']},
    {'id': '15', 'value': 'S_DISTANCE',             'variables': ['V_DISTANCE', 'V_UNIT_PREFIX']},
    {'id': '16', 'value': 'S_LIGHT_LEVEL',          'variables': ['V_LIGHT_LEVEL', 'V_LEVEL']},
    {'id': '17', 'value': 'S_ARDUINO_NODE',         'variables': []},
    {'id': '18', 'value': 'S_ARDUINO_REPEATER_NODE','variables': []},
    {'id': '19', 'value': 'S_LOCK',                 'variables': ['V_LOCK_STATUS']},
    {'id': '20', 'value': 'S_IR',                   'variables': ['V_IR_SEND', 'V_IR_RECEIVE', 'V_IR_RECORD']},
    {'id': '21', 'value': 'S_WATER',                'variables': ['V_FLOW', 'V_VOLUME']},
    {'id': '22', 'value': 'S_AIR_QUALITY',          'variables': ['V_LEVEL', 'V_UNIT_PREFIX']},
    {'id': '23', 'value': 'S_CUSTOM',               'variables': []},
    {'id': '24', 'value': 'S_DUST',                 'variables': ['V_LEVEL', 'V_UNIT_PREFIX']},
    {'id': '25', 'value': 'S_SCENE_CONTROLLER',     'variables': ['V_SCENE_ON', 'V_SCENE_OFF']},
    {'id': '26', 'value': 'S_RGB_LIGHT',            'variables': ['V_RGB', 'V_WATT']},
    {'id': '27', 'value': 'S_RGBW_LIGHT',           'variables': ['V_RGBW', 'V_WATT']},
    {'id': '28', 'value': 'S_COLOR_SENSOR',         'variables': ['V_RGB']},
    {'id': '29', 'value': 'S_HVAC',                 'variables': ['V_STATUS', 'V_TEMP', 'V_HVAC_SETPOINT_HEAT', 'V_HVAC_SETPOINT_COLD', 'V_HVAC_FLOW_STATE', 'V_HVAC_FLOW_MODE', 'V_HVAC_SPEED']},
    {'id': '30', 'value': 'S_MULTIMETER',           'variables': ['V_VOLTAGE', 'V_CURRENT', 'V_IMPEDANCE']},
    {'id': '31', 'value': 'S_SPRINKLER',            'variables': ['V_STATUS', 'V_TRIPPED']},
    {'id': '32', 'value': 'S_WATER_LEAK',           'variables': ['V_TRIPPED', 'V_ARMED']},
    {'id': '33', 'value': 'S_SOUND',                'variables': ['V_LEVEL', 'V_TRIPPED', 'V_ARMED']},
    {'id': '34', 'value': 'S_VIBRATION',            'variables': ['V_LEVEL', 'V_TRIPPED', 'V_ARMED']},
    {'id': '35', 'value': 'S_MOISTURE',             'variables': ['V_LEVEL', 'V_TRIPPED', 'V_ARMED']},
    {'id': '36', 'value': 'S_INFO',                 'variables': ['V_TEXT']},
    {'id': '37', 'value': 'S_GAS',                  'variables': ['V_FLOW', 'V_VOLUME']},
    {'id': '38', 'value': 'S_GPS',                  'variables': ['V_POSITION']},
    {'id': '39', 'value': 'S_WATER_QUALITY',        'variables': ['V_TEMP', 'V_PH', 'V_ORP', 'V_EC', 'V_STATUS']}
];

exports.req_set = [
    {'id': '0', 'value': 'V_TEMP',                  'capabilities': {'type': 'sensor', 'sub_type': 'measure_temperature', 'parse_value': 'number'}},
    {'id': '1', 'value': 'V_HUM',                   'capabilities': {'type': 'sensor', 'sub_type': 'measure_humidity', 'parse_value': 'number'}},
    {'id': '2', 'value': 'V_STATUS',                'capabilities': {'type': 'socket', 'sub_type': 'onoff', 'parse_value': 'boolean'}},
    {'id': '3', 'value': 'V_PERCENTAGE',            'capabilities': {'type': 'light', 'sub_type': 'dim', 'parse_value': 'number'}},
    {'id': '4', 'value': 'V_PRESSURE',              'capabilities': {'type': 'sensor', 'sub_type': 'measure_pressure', 'parse_value': 'number'}},
    {'id': '5', 'value': 'V_FORECAST',              'capabilities': {'type': 'sensor', 'sub_type': 'measure_pressure', 'parse_value': ''}},
    {'id': '6', 'value': 'V_RAIN',                  'capabilities': {'type': 'sensor', 'sub_type': 'measure_rain', 'parse_value': 'number'}},
    {'id': '7', 'value': 'V_RAINRATE',              'capabilities': {'type': 'sensor', 'sub_type': 'measure_rain', 'parse_value': 'number'}},
    {'id': '8', 'value': 'V_WIND',                  'capabilities': {'type': 'sensor', 'sub_type': 'measure_wind_strength', 'parse_value': 'number'}},
    {'id': '9', 'value': 'V_GUST',                  'capabilities': {'type': 'sensor', 'sub_type': 'measure_gust_strength', 'parse_value': 'number'}},
    {'id': '10', 'value': 'V_DIRECTION',            'capabilities': {'type': 'sensor', 'sub_type': 'measure_wind_angle', 'parse_value': 'number'}},
    {'id': '11', 'value': 'V_UV',                   'capabilities': {'type': 'sensor', 'sub_type': 'measure_ultraviolet', 'parse_value': 'number'}},
    {'id': '12', 'value': 'V_WEIGHT',               'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '13', 'value': 'V_DISTANCE',             'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '14', 'value': 'V_IMPEDANCE',            'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '15', 'value': 'V_ARMED',                'capabilities': {'type': 'sensor', 'sub_type': 'alarm_contact', 'parse_value': 'boolean'}},
    {'id': '16', 'value': 'V_TRIPPED',              'capabilities': {'type': 'socket', 'sub_type': 'onoff', 'parse_value': 'boolean'}},
    {'id': '17', 'value': 'V_WATT',                 'capabilities': {'type': 'sensor', 'sub_type': 'measure_power', 'parse_value': 'number'}},
    {'id': '18', 'value': 'V_KWH',                  'capabilities': {'type': 'sensor', 'sub_type': 'measure_power', 'parse_value': 'number'}},
    {'id': '19', 'value': 'V_SCENE_ON',             'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '20', 'value': 'V_SCENE_OFF',            'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '21', 'value': 'V_HVAC_FLOW_STATE',      'capabilities': {'type': 'sensor', 'sub_type': 'measure_temperature', 'parse_value': 'number'}},
    {'id': '22', 'value': 'V_HVAC_SPEED',           'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '23', 'value': 'V_LIGHT_LEVEL',          'capabilities': {'type': 'sensor', 'sub_type': 'measure_luminance', 'parse_value': 'number'}},
    {'id': '24', 'value': 'V_VAR1',                 'capabilities': {'type': 'other', 'sub_type': 'mysensors_custom', 'parse_value': ''}},
    {'id': '25', 'value': 'V_VAR2',                 'capabilities': {'type': 'other', 'sub_type': 'mysensors_custom', 'parse_value': ''}},
    {'id': '26', 'value': 'V_VAR3',                 'capabilities': {'type': 'other', 'sub_type': 'mysensors_custom', 'parse_value': ''}},
    {'id': '27', 'value': 'V_VAR4',                 'capabilities': {'type': 'other', 'sub_type': 'mysensors_custom', 'parse_value': ''}},
    {'id': '28', 'value': 'V_VAR5',                 'capabilities': {'type': 'other', 'sub_type': 'mysensors_custom', 'parse_value': ''}},
    {'id': '29', 'value': 'V_UP',                   'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '30', 'value': 'V_DOWN',                 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '31', 'value': 'V_STOP',                 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '32', 'value': 'V_IR_SEND',              'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '33', 'value': 'V_IR_RECEIVE',           'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '34', 'value': 'V_FLOW',                 'capabilities': {'type': 'other', 'sub_type': 'mysensors_water_flow', 'parse_value': 'number'}},
    {'id': '35', 'value': 'V_VOLUME',               'capabilities': {'type': 'sensor', 'sub_type': 'meter_water', 'parse_value': 'number'}},
    {'id': '36', 'value': 'V_LOCK_STATUS',          'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '37', 'value': 'V_LEVEL',                'capabilities': {'type': 'sensor', 'sub_type': 'measure_luminance', 'parse_value': 'number'}},
    {'id': '38', 'value': 'V_VOLTAGE',              'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '39', 'value': 'V_CURRENT',              'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '40', 'value': 'V_RGB',                  'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '41', 'value': 'V_RGBW',                 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '42', 'value': 'V_ID',                   'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '43', 'value': 'V_UNIT_PREFIX',          'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '44', 'value': 'V_HVAC_SETPOINT_COOL',   'capabilities': {'type': 'sensor', 'sub_type': 'measure_temperature', 'parse_value': 'number'}},
    {'id': '45', 'value': 'V_HVAC_SETPOINT_HEAT',   'capabilities': {'type': 'sensor', 'sub_type': 'measure_temperature', 'parse_value': 'number'}},
    {'id': '46', 'value': 'V_HVAC_FLOW_MODE',       'capabilities': {'type': 'sensor', 'sub_type': 'measure_temperature', 'parse_value': 'number'}},
    {'id': '47', 'value': 'V_TEXT',                 'capabilities': {'type': 'other', 'sub_type': 'mysensors_custom', 'parse_value': ''}},
    {'id': '48', 'value': 'V_CUSTOM',               'capabilities': {'type': 'other', 'sub_type': 'mysensors_custom', 'parse_value': ''}},
    {'id': '49', 'value': 'V_POSITION',             'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '50', 'value': 'V_IR_RECORD',            'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '51', 'value': 'V_PH',                   'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '52', 'value': 'V_ORP',                  'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '53', 'value': 'V_EC',                   'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '54', 'value': 'V_VAR',                  'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '55', 'value': 'V_VA',                   'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '56', 'value': 'V_POWER_FACTOR',         'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}}
];

exports.internal = [
    {'id': '0', 'value': 'I_BATTERY_LEVEL'},
    {'id': '1', 'value': 'I_TIME'},
    {'id': '2', 'value': 'I_VERSION'},
    {'id': '3', 'value': 'I_ID_REQUEST'},
    {'id': '4', 'value': 'I_ID_RESPONSE'},
    {'id': '5', 'value': 'I_INCLUSION_MODE'},
    {'id': '6', 'value': 'I_CONFIG'},
    {'id': '7', 'value': 'I_FIND_PARENT'},
    {'id': '8', 'value': 'I_FIND_PARENT_RESPONSE'},
    {'id': '9', 'value': 'I_LOG_MESSAGE'},
    {'id': '10', 'value': 'I_CHILDREN'},
    {'id': '11', 'value': 'I_SKETCH_NAME'},
    {'id': '12', 'value': 'I_SKETCH_VERSION'},
    {'id': '13', 'value': 'I_REBOOT'},
    {'id': '14', 'value': 'I_GATEWAY_READY'},
    {'id': '15', 'value': 'I_SIGNING_PRESENTATION'},
    {'id': '16', 'value': 'I_NONCE_REQUEST'},
    {'id': '17', 'value': 'I_NONCE_RESPONSE'},
    {'id': '18', 'value': 'I_HEARTBEAT_REQUEST'},
    {'id': '19', 'value': 'I_PRESENTATION'},
    {'id': '20', 'value': 'I_DISCOVER_REQUEST'},
    {'id': '21', 'value': 'I_DISCOVER_RESPONSE'},
    {'id': '22', 'value': 'I_HEARTBEAT_RESPONSE'},
    {'id': '23', 'value': 'I_LOCKED'},
    {'id': '24', 'value': 'I_PING'},
    {'id': '25', 'value': 'I_PONG'},
    {'id': '26', 'value': 'I_REGISTRATION_REQUEST'},
    {'id': '27', 'value': 'I_REGISTRATION_RESPONSE'},
    {'id': '28', 'value': 'I_DEBUG'}
];

exports.stream = [
    {'id': '0', 'value': 'default'}
];