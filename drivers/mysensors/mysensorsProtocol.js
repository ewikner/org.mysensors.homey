exports.decodeMessage = function (messageStr,splitChar) {

    if (!messageStr) {
        return null;
    }

    var messageArr = messageStr.split(splitChar);
    if (!messageArr || messageArr.length !== 6) {
        Homey.log("decode err")
        return null;
    }

    var messageObj = {
        nodeId: messageArr[0],
        sensorId: messageArr[1],
        messageType: this.types[messageArr[2]].value,
        ack: messageArr[3],
        subType: this[this.types[messageArr[2]].value][messageArr[4]].value,
        payload: messageArr[5]
    };

    return messageObj;
};

exports.encodeMessage = function (messageObj,splitChar) {
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

    this[messageObj.messageType].forEach(function(item, index) {
        if(item.value == messageObj.subType) {
            encodedObj.push(item.id);
        }
    });
    encodedObj.push(messageObj.payload);
    return encodedObj.join(splitChar);
}

exports.getCapabilities = function(type) {
    var capabilities = null;
    this.presentation.forEach(function(item, index) {
        if(item.value == type) {
            capabilities = item.capabilities
            return capabilities;
        }
    });
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
    {'id': '0', 'value': 'S_DOOR', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '1', 'value': 'S_MOTION', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '2', 'value': 'S_SMOKE', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '3', 'value': 'S_LIGHT', 'capabilities': {'type': 'light', 'sub_type': 'onoff', 'parse_value': ''}},
    {'id': '4', 'value': 'S_DIMMER', 'capabilities': {'type': 'light', 'sub_type': 'dim', 'parse_value': ''}},
    {'id': '5', 'value': 'S_COVER', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '6', 'value': 'S_TEMP', 'capabilities': {'type': 'sensor', 'sub_type': 'measure_temperature', 'parse_value': 'parseToFloat'}},
    {'id': '7', 'value': 'S_HUM', 'capabilities': {'type': 'sensor', 'sub_type': 'measure_humidity', 'parse_value': 'parseToFloat'}},
    {'id': '8', 'value': 'S_BARO', 'capabilities': {'type': 'sensor', 'sub_type': 'measure_pressure', 'parse_value': 'parseToFloat'}},
    {'id': '9', 'value': 'S_WIND', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '10', 'value': 'S_RAIN', 'capabilities': {'type': 'sensor', 'sub_type': 'measure_rain', 'parse_value': 'parseToFloat'}},
    {'id': '11', 'value': 'S_UV', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '12', 'value': 'S_WEIGHT', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '13', 'value': 'S_POWER', 'capabilities': {'type': 'sensor', 'sub_type': 'measure_power', 'parse_value': 'parseToFloat'}},
    {'id': '14', 'value': 'S_HEATER', 'capabilities': {'type': '', 'sub_type': 'measure_temperature', 'parse_value': 'parseToFloat'}},
    {'id': '15', 'value': 'S_DISTANCE', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '16', 'value': 'S_LIGHT_LEVEL', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '17', 'value': 'S_ARDUINO_NODE', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '18', 'value': 'S_ARDUINO_RELAY', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '19', 'value': 'S_LOCK', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '20', 'value': 'S_IR', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '21', 'value': 'S_WATER', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '22', 'value': 'S_AIR_QUALITY', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '23', 'value': 'S_CUSTOM', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '24', 'value': 'S_DUST', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '25', 'value': 'S_SCENE_CONTROLLER', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '26', 'value': 'S_RGB_LIGHT', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '27', 'value': 'S_RGBW_LIGHT', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '28', 'value': 'S_COLOR_SENSOR', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '29', 'value': 'S_HVAC', 'capabilities': {'type': '', 'sub_type': 'measure_temperature', 'parse_value': 'parseToFloat'}},
    {'id': '30', 'value': 'S_MULTIMETER', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '31', 'value': 'S_SPRINKLER', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '32', 'value': 'S_WATER_LEAK', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '33', 'value': 'S_SOUND', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '34', 'value': 'S_VIBRATION', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '35', 'value': 'S_MOISTURE', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '36', 'value': 'S_INFO', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '37', 'value': 'S_GAS', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}},
    {'id': '38', 'value': 'S_BATTERY', 'capabilities': {'type': 'sensor', 'sub_type': 'measure_battery', 'parse_value': 'parseToFloat'}},
    {'id': '39', 'value': 'S_WATER_QUALITY', 'capabilities': {'type': '', 'sub_type': '', 'parse_value': ''}}
];

exports.req = [
    {'id': '0', 'value': 'V_TEMP'},
    {'id': '1', 'value': 'V_HUM'},
    {'id': '2', 'value': 'V_STATUS'},
    {'id': '3', 'value': 'V_PERCENTAGE'},
    {'id': '4', 'value': 'V_PRESSURE'},
    {'id': '5', 'value': 'V_FORECAST'},
    {'id': '6', 'value': 'V_RAIN'},
    {'id': '7', 'value': 'V_RAINRATE'},
    {'id': '8', 'value': 'V_WIND'},
    {'id': '9', 'value': 'V_GUST'},
    {'id': '10', 'value': 'V_DIRECTION'},
    {'id': '11', 'value': 'V_UV'},
    {'id': '12', 'value': 'V_WEIGHT'},
    {'id': '13', 'value': 'V_DISTANCE'},
    {'id': '14', 'value': 'V_IMPEDANCE'},
    {'id': '15', 'value': 'V_ARMED'},
    {'id': '16', 'value': 'V_TRIPPED'},
    {'id': '17', 'value': 'V_WATT'},
    {'id': '18', 'value': 'V_KWH'},
    {'id': '19', 'value': 'V_SCENE_ON'},
    {'id': '20', 'value': 'V_SCENE_OFF'},
    {'id': '21', 'value': 'V_HVAC_FLOW_STATE'},
    {'id': '22', 'value': 'V_HVAC_SPEED'},
    {'id': '23', 'value': 'V_LIGHT_LEVEL'},
    {'id': '24', 'value': 'V_VAR1'},
    {'id': '25', 'value': 'V_VAR2'},
    {'id': '26', 'value': 'V_VAR3'},
    {'id': '27', 'value': 'V_VAR4'},
    {'id': '28', 'value': 'V_VAR5'},
    {'id': '29', 'value': 'V_UP'},
    {'id': '30', 'value': 'V_DOWN'},
    {'id': '31', 'value': 'V_STOP'},
    {'id': '32', 'value': 'V_IR_SEND'},
    {'id': '33', 'value': 'V_IR_RECEIVE'},
    {'id': '34', 'value': 'V_FLOW'},
    {'id': '35', 'value': 'V_VOLUME'},
    {'id': '36', 'value': 'V_LOCK_STATUS'},
    {'id': '37', 'value': 'V_LEVEL'},
    {'id': '38', 'value': 'V_VOLTAGE'},
    {'id': '39', 'value': 'V_CURRENT'},
    {'id': '40', 'value': 'V_RGB'},
    {'id': '41', 'value': 'V_RGBW'},
    {'id': '42', 'value': 'V_ID'},
    {'id': '43', 'value': 'V_UNIT_PREFIX'},
    {'id': '44', 'value': 'V_HVAC_SETPOINT_COOL'},
    {'id': '45', 'value': 'V_HVAC_SETPOINT_HEAT'},
    {'id': '46', 'value': 'V_HVAC_FLOW_MODE'},
    {'id': '47', 'value': 'V_TEXT'},
    {'id': '48', 'value': 'V_CUSTOM'},
    {'id': '49', 'value': 'V_POSITION'},
    {'id': '50', 'value': 'V_IR_RECORD'},
    {'id': '51', 'value': 'V_PH'},
    {'id': '52', 'value': 'V_ORP'},
    {'id': '53', 'value': 'V_EC'}
];

exports.set = [
    {'id': '0', 'value': 'V_TEMP'},
    {'id': '1', 'value': 'V_HUM'},
    {'id': '2', 'value': 'V_STATUS'},
    {'id': '3', 'value': 'V_PERCENTAGE'},
    {'id': '4', 'value': 'V_PRESSURE'},
    {'id': '5', 'value': 'V_FORECAST'},
    {'id': '6', 'value': 'V_RAIN'},
    {'id': '7', 'value': 'V_RAINRATE'},
    {'id': '8', 'value': 'V_WIND'},
    {'id': '9', 'value': 'V_GUST'},
    {'id': '10', 'value': 'V_DIRECTION'},
    {'id': '11', 'value': 'V_UV'},
    {'id': '12', 'value': 'V_WEIGHT'},
    {'id': '13', 'value': 'V_DISTANCE'},
    {'id': '14', 'value': 'V_IMPEDANCE'},
    {'id': '15', 'value': 'V_ARMED'},
    {'id': '16', 'value': 'V_TRIPPED'},
    {'id': '17', 'value': 'V_WATT'},
    {'id': '18', 'value': 'V_KWH'},
    {'id': '19', 'value': 'V_SCENE_ON'},
    {'id': '20', 'value': 'V_SCENE_OFF'},
    {'id': '21', 'value': 'V_HVAC_FLOW_STATE'},
    {'id': '22', 'value': 'V_HVAC_SPEED'},
    {'id': '23', 'value': 'V_LIGHT_LEVEL'},
    {'id': '24', 'value': 'V_VAR1'},
    {'id': '25', 'value': 'V_VAR2'},
    {'id': '26', 'value': 'V_VAR3'},
    {'id': '27', 'value': 'V_VAR4'},
    {'id': '28', 'value': 'V_VAR5'},
    {'id': '29', 'value': 'V_UP'},
    {'id': '30', 'value': 'V_DOWN'},
    {'id': '31', 'value': 'V_STOP'},
    {'id': '32', 'value': 'V_IR_SEND'},
    {'id': '33', 'value': 'V_IR_RECEIVE'},
    {'id': '34', 'value': 'V_FLOW'},
    {'id': '35', 'value': 'V_VOLUME'},
    {'id': '36', 'value': 'V_LOCK_STATUS'},
    {'id': '37', 'value': 'V_LEVEL'},
    {'id': '38', 'value': 'V_VOLTAGE'},
    {'id': '39', 'value': 'V_CURRENT'},
    {'id': '40', 'value': 'V_RGB'},
    {'id': '41', 'value': 'V_RGBW'},
    {'id': '42', 'value': 'V_ID'},
    {'id': '43', 'value': 'V_UNIT_PREFIX'},
    {'id': '44', 'value': 'V_HVAC_SETPOINT_COOL'},
    {'id': '45', 'value': 'V_HVAC_SETPOINT_HEAT'},
    {'id': '46', 'value': 'V_HVAC_FLOW_MODE'},
    {'id': '47', 'value': 'V_TEXT'},
    {'id': '48', 'value': 'V_CUSTOM'},
    {'id': '49', 'value': 'V_POSITION'},
    {'id': '50', 'value': 'V_IR_RECORD'},
    {'id': '51', 'value': 'V_PH'},
    {'id': '52', 'value': 'V_ORP'},
    {'id': '53', 'value': 'V_EC'}
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
    {'id': '15', 'value': 'I_REQUEST_SIGNING'},
    {'id': '16', 'value': 'I_GET_NONCE'},
    {'id': '17', 'value': 'I_GET_NONCE_RESPONSE'},
    {'id': '18', 'value': 'I_HEARTBEAT'},
    {'id': '19', 'value': 'I_PRESENTATION'},
    {'id': '20', 'value': 'I_DISCOVER'},
    {'id': '21', 'value': 'I_DISCOVER_RESPONSE'},
    {'id': '22', 'value': 'I_HEARTBEAT_RESPONSE'},
    {'id': '23', 'value': 'I_LOCKED'}
];