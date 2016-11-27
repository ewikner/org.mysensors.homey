angular.module('settingsApp', []).controller('settingsCtrl', ['$scope', '$timeout', function($scope, $timeout) {
  $scope.showDebugChange = function() {
      Homey.set('mys_show_debug', $scope.mys_show_debug, function(err, value) {
        if (!err) {
          $scope.displayMessage(__('settings.change_mys_show_debug'));
        } else {
          console.log(err)
        }
      });
  };

  $scope.displayMessage = function(text) {
    if ($scope.msgPromise != null) {
      $timeout.cancel($scope.msgPromise);
    }
    $scope.$apply(function() {
      $scope.message = text;
    });

    $(".message").slideDown();

    $scope.msgPromise = $timeout(function() {
      $scope.message = '';
      $(".message").slideUp();

    }, 5000);
  }

  $scope.saveSettings = function(form) {
    if (form.$valid) {
      Homey.set('mys_settings', $scope.settings, function(err, value) {
        if (!err) {
          $scope.displayMessage(__('settings.script.success'));
        } else {
          console.log(err)
        }
      });
    }
  }

  $scope.getSettings = function() {
    Homey.get('mys_settings', function(err, result) {
      if (err) { 
        return console.error('Could not get settings', err);
      }
      $scope.settings = result;
      $scope.$apply();
    });

    Homey.get('mys_show_debug', function(err, value) {
        if (err) { 
          return console.error('Could not get settings', err);
        }
        $scope.mys_show_debug = value;
        $scope.$apply();
      });
  }

  $scope.getSettings();
}]);

angular.module('messageLog', ['ui.grid']).controller('messageLogCtrl', ['$scope', '$http', 'uiGridConstants', function ($scope, $http, uiGridConstants) {
    var mydata = [];

    $scope.gridOptions = {
        data: mydata,
        enableColumnResizing: false,
        columnDefs: [
            { name: 'Timestamp', enableSorting: true, enableColumnMenu: false,width: 200, sort: {direction: uiGridConstants.DESC,priority: 1}},
            { name: 'Direction', enableSorting: false, enableColumnMenu: false, width: 80 },
            { name: 'Node', enableSorting: false, enableColumnMenu: false, width: 80 },
            { name: 'Sensor', enableSorting: false, enableColumnMenu: false, width: 100},
            { name: 'Type', enableSorting: false, enableColumnMenu: false, width: 150},
            { name: 'Ack', enableSorting: false, enableColumnMenu: false, width: 80},
            { name: 'MessageType', enableSorting: false, enableColumnMenu: false, width: 350},
            { name: 'Payload', enableSorting: false, enableColumnMenu: false},
            { name: 'Debug', enableSorting: false, enableColumnMenu: false}
        ],
        onRegisterApi: function( gridApi ) {
          $scope.gridApi = gridApi;
        }
    };

    $scope.addNewMessage = function(data) {
        var timeStamp = new Date(data.debugObj.t).toISOString().replace(/T/, ' ').replace(/\..+/, '');
        var newRow = {
            "Timestamp": timeStamp,
            "Direction": data.direction,
            "Node": data.nodeId,
            "Sensor": data.sensorId,
            "Type": data.messageType,
            "Ack": data.ack,
            "MessageType": data.subType,
            "Payload": data.payload,
            "Debug": data.debugObj.s,
        };
        $scope.gridOptions.data.push(newRow);
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.ALL);
    };
    $scope.clearData = function() {
        $scope.gridOptions.data = [];
        var timeStamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
        var newRow = {
            "Timestamp": timeStamp,
            "Direction": 'CLEARLOG',
            "Node": '',
            "Sensor": '',
            "Type": '',
            "Ack": '',
            "MessageType": '',
            "Payload": '',
            "Debug": '',
        };
        $scope.gridOptions.data.push(newRow);
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.ALL);
    };
}]);

function initMessageLog () {
  loadMessageLogFromSettings()
  Homey.on('mySensorMessageLog', function (data) {
    $("#messageLogGrid").scope().addNewMessage(data);
  })
}

function loadMessageLogFromSettings () {
  Homey.get('mySensorMessageLog', function (error, value) {
    if (error) {
      return console.error(error)
    }
    if (value != null) {
      $.each(value, function (index, data) {
        $("#messageLogGrid").scope().addNewMessage(data);
      })
    }
  })
}

function clearLog() {
  Homey.set('mySensorMessageLog', [], function(err, result){
    if( err ) return console.error('Could not save mySensorMessageLog', err);
    $("#messageLogGrid").scope().clearData();
  });
}
function onHomeyReady(){
  $(".message").hide();
  initMessageLog();

  angular.bootstrap(document, ['settingsApp','messageLog']);
  
  Homey.ready();
}