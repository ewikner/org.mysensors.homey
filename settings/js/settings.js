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

  $scope.myMessageLogCountChange = function() {
      Homey.set('myMessageLogCount', $scope.myMessageLogCount, function(err, value) {
        if (!err) {
          $scope.displayMessage(__('settings.change_myMessageLogCount'));
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

    Homey.get('myMessageLogCount', function(err, value) {
        if (err) { 
          return console.error('Could not get settings', err);
        }
        $scope.myMessageLogCount = value;
        $scope.$apply();
      });
  }

  $scope.getSettings();
}]);

angular.module('messageLog', ['ui.grid']).controller('messageLogCtrl', ['$scope', '$http', 'uiGridConstants', function ($scope, $http, uiGridConstants) {
    var mydata = [];

    $scope.gridOptions = {
        data: mydata,
        flatEntityAccess: true,
        enableColumnResizing: false,
        columnDefs: [
            { name: 'Timestamp', enableSorting: true, enableColumnMenu: false,width: 200, type:'date', cellFilter: 'date:"yyyy-MM-dd HH:mm:ss"',sort: {direction: uiGridConstants.DESC,priority: 1}},
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
        $scope.gridOptions.data.push(data);
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.ALL);
    };
    $scope.addMessageList = function(data) {
        $scope.gridOptions.data = data;
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.ALL);
    };
    $scope.clearData = function() {
        $scope.gridOptions.data = [];
        var timeStamp = new Date();
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

  Homey.on('newMySensorMessage', function (data) {
    $("#messageLogGrid").scope().addNewMessage(data);
  })

  Homey.on('reloadMySensorMessage', function (data) {
    loadMessageLogFromSettings();
  })
}

function loadMessageLogFromSettings () {
  Homey.get('mySensorMessageLog', function (error, value) {
    if (error) {
      return console.error(error)
    }
    if (value != null) {
      $("#messageLogGrid").scope().addMessageList(value);
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