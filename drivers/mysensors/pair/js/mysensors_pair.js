Homey.setTitle( __("pair.title"));

var selectedNode = null;
var selectedSensor = null;
var devices = null;
var capabilitiesArray = new Array();
var sensorTypesArray = new Array();

function loadCapabilities() {
	$( "#sensor_capability" ).empty();

	$( "#sensor_capability" ).append($("<option></option>")
			.attr("value",'')
			.text('- '+ __("pair.select_capability") +' -'));

	$.each(capabilitiesArray, function(key, value) {   
		$( "#sensor_capability" ).append($("<option></option>")
			.attr("value",value.id)
			.text(value.label)); 
	});
}

function showError( msg ) {
  $( "#error_msg" )
    .text( msg ).show();
  setTimeout(function() {
    $( "#error_msg" ).hide();
  }, 2000 );
}

function closeModal() {
	$( "#node_name" ).val('');
	$( "#sensor_capability" ).val('');
	selectedNode = null;
	selectedSensor = null;
	$( "#mysensor-form" ).modal("hide");
}

function onClickLi(row) {
	
	selectedNode = $(row).data('data');

	$( "#node_name" ).val(selectedNode.name);
	$( "#node_show_lastseen" ).prop('checked', selectedNode.showLastSeen);
	$( "#node_show_battery" ).prop('checked', selectedNode.showBatteryLevel);
	$( "#node_send_ack" ).prop('checked', selectedNode.sendAck);

	listSensors(selectedNode);

	$("#sensorsList").hide();
	$("#btnShowList").text( __("pair.showSensorList") );
	$("#nodeAlert").hide();
	$("#nodeAlert").text();

	$("#mysensor-form").modal("show");
}

function onClickSensor(row) {
	$("#nodeAlert").hide();
	selectedSensor = $(row).data('data');
	selectSensor(selectedSensor);

}

function listSensors(node) {
	$("#sensorsList").empty();

	if(Object.keys(node.sensors).length == 0) {
		$("#sensorsList").text( __("pair.noSensors"));
	} else {
		$.each(node.sensors, function(i,v) {
			if(v != null) {
				var img = $('<span>').attr('class','glyphicon icon-mys').append("");
				var label = $('<span>').attr('class','label_padding').append(v.sensorId+": "+v.sensorType);
				$("#sensorsList").append($('<a>').attr('class','list-group-item').attr('onclick','onClickSensor(this)').append(img, label).data('data',v));
			}
		});
	}
}

function listDevices() {
	var iconPath = 'icon.svg';

	$.each(devices, function(i,v) {
		var img = $('<span>').attr('class','glyphicon icon-mys').append("");
		var label = $('<span>').attr('class','label_padding').append(v.nodeId);
		$("#node_list").append($('<a>').attr('class','list-group-item').attr('onclick','onClickLi(this)').append(img, label).data('data',v));
	});
}
function init() {
	$( "#sensorsList" ).hide();
	
	$( "#sensor-form" ).modal("hide");
	$( "#mysensor-form" ).modal("hide");
	$( "#error_msg" ).hide();

	$("#node_list").empty();

	Homey.emit('initPair', function(deviceArr, extraArr) {
	 	$("#node_list").empty();
		if(deviceArr !== undefined) {
			if(deviceArr.length == 0) {
				$("#node_list").text( __("pair.noNodes") );
			} else {
				$.each(extraArr.homey_capabilities, function(key, value) {
					var capaName = Object.getOwnPropertyNames(value);
					capabilitiesArray.push({id: key, label: key});
				});

				loadCapabilities();

				var mySensorTypes = extraArr.mysensors_types;
				$.each(mySensorTypes, function(key, obj) {
					sensorTypesArray.push({id: obj.value, label: obj.value, children: obj.capabilities});
				});

				devices = deviceArr;
				listDevices();
			}
		} else {
			$("#node_list").text( __("pair.noNodes") );
		}
	});
}

function addNode() {
	selectedNode.name = $( "#node_name" ).val();
	selectedNode.showLastSeen = $( "#node_show_lastseen" ).is(":checked");
	selectedNode.showBatteryLevel = $( "#node_show_battery" ).is(":checked");
	selectedNode.sendAck = $( "#node_send_ack" ).is(":checked");

	var sensorsOk = true;
	$.each(selectedNode.sensors, function(i,v) {
		if(v != null) {
			if(v.capability == '' || v.capability == null) {
				$("#nodeAlert").show();
				$("#nodeAlert").text(v.sensorId+": "+v.sensorType+" "+__("pair.errors.sensor_no_capability"));
				sensorsOk = false;
			}
		}
	});
	if(sensorsOk) {
		Homey.emit( 'addedNodePair', selectedNode, function( err, node_device ){
			if(err == null) {
			    Homey.addDevice(node_device, function( err, result ){
			    	if(err) {
		    			$("#nodeAlert").show();
						$("#nodeAlert").text( err);
		    		} else {
		    			$("#nodeAlert").text( result);
			    		Homey.emit( 'addedDevicePair', node_device, function(err) {
			    			init();
			    			$( "#mysensor-form" ).modal("hide");
			    		});
			    	}
				});
			}
		});
	}
}

function showHideSensors() {
	$( "#sensorsList" ).toggle();
	if($("#sensorsList").is(':hidden')) {
		$("#btnShowList").text( __("pair.showSensorList"));
	} else {
		$("#btnShowList").text( __("pair.hideSensorList"));
	}
	
}

function loadSensorTypeDropdown() {
	$( "#sensor_types" ).empty();

	$( "#sensor_types" ).append($("<option></option>")
			.attr("value",'')
			.text('- '+ __("pair.selectSensorType") +' -'));

	$.each(sensorTypesArray, function(key, value) {   
		$( "#sensor_types" ).append($("<option></option>")
			.attr("value",value.id)
			.text(value.label)
			.data('children', value.children));
	});
}

function selectSensor(sensor) {

	$( "#sensor_error_msg" ).hide();
	loadSensorTypeDropdown();

	if(sensor != null) {
		$( "#sensorId" ).val(sensor.sensorId);
		$( "#sensor_title").val(sensor.title);
		$( "#sensor_types" ).val(sensor.sensorType);
		var capability = sensor.capability;
		if(capability != null) {
			if(capability.indexOf('.') !== -1) {
				capability = capability.substring(0, capability.indexOf('.'))
			}
		}
		$( "#sensor_capability" ).val(capability);
		
		if((sensor.capability == '') || (sensor.capability == null)) {
			selectSensorCapability();
		}
	} else {
		selectedSensor = null;
		$( "#sensorId" ).val('');
		$( "#sensor_title" ).val('');
		$( "#sensor_types" ).val('');
		$( "#sensor_capability" ).val('');
	}

	$( "#sensor-form" ).modal("show");
	$( "#sensorIDAlert" ).hide();
}

function saveSensor() {
	if(selectedSensor == null) {
		selectedSensor = {};
		selectedSensor.new = true;
	} else {
		selectedSensor.new = false;
	}
	selectedSensor.sensorId = $( "#sensorId" ).val();
	selectedSensor.title = $( "#sensor_title" ).val();
	selectedSensor.sensorType = $( "#sensor_types" ).val();
	selectedSensor.capability = $( "#sensor_capability" ).val();
	if(selectedSensor.capability == '') {
		$("#sensor_error_msg").show();
		$("#sensor_error_msg").text( __("pair.errors.sensor_capability") );
	} else {
		$("#sensor_error_msg").hide();
		selectedNode.sensors[selectedSensor.sensorId] = selectedSensor;

		listSensors(selectedNode);

		$( "#sensor-form" ).modal("hide");
	}
}

function removeSensor() {
	var sensorId = $( "#sensorId" ).val();
	if (sensorId in selectedNode.sensors) {
		selectedNode.sensors[sensorId] = null;
	}
	listSensors(selectedNode);
	$( "#sensor-form" ).modal("hide");
}

function closeSensor() {
	$( "#sensor-form" ).modal("hide");
}

function selectSensorCapability() {
	var selectedSensorType = $( "#sensor_types" ).find(":selected");
	var selectedChildren = selectedSensorType.data('children');
	var selected_sub_type = selectedChildren.sub_type;
	$( "#sensor_capability" ).val(selected_sub_type);
}

$( "#sensor_types" ).on( "change", function() {
	selectSensorCapability();
});

$('#sensorId').on('change keyup', function() {
	var tmpSensorId = $( "#sensorId" ).val();
	if((tmpSensorId < 255) && (tmpSensorId >= 0)) {
		if(tmpSensorId in selectedNode.sensors) {
			$("#sensorIDAlert").show();
			$("#sensorIDAlert").text( __("pair.errors.sensor_exists") );
			$("#saveSensorBtn").prop('disabled', true);
		} else {
			$("#sensorIDAlert").hide();
			$("#saveSensorBtn").prop('disabled', false);
		}
	} else {
		$("#sensorIDAlert").show();
		$("#sensorIDAlert").text( __("pair.errors.sensor_between"));
		$("#saveSensorBtn").prop('disabled', true);
	}
});

$( "#mysensor-form" ).modal("hide");
$( "#error_msg" ).hide();
$( "#sensorIDAlert" ).hide();
init();