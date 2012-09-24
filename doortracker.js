var room_name = "Paul's room";

var arduino = require('duino'),
    board = new arduino.Board({
      debug: false
    });

var http = require('http');

// controls the ports for the light sensors
var light_ports = ["A0", "A1"];

// stores the verified id for the current user
var current_vid = 0;

// controls the threshold for detecting a walker
// a fraction of the average light that needs to be surpassed
var light_threshold_fraction = 1.1;

// controls the frequency of checking for input
// a time in milliseconds to check
var check_period = 500;

// controls the time to count as going in one direction through door
var DOOR_THRESHOLD_TIME = 1000;

// Stores the number of samples to keep track of
var size_light_array = 10;

// Stores the times since last triggered
var light_port_times = Array(light_ports.length);

// Array of arrays to hold the last couple iterations of light values
// so we know if there is a person walking under the light sensor
var light_array_array = [];
// make the array as long as the list of ports
for (var i = 0; i < light_ports.length; i++) {
  light_array_array.push([]);
}

// Assumes array of numbers
Array.prototype.sum = function() {
  return this.reduce(function(a, b) {return a+b});
}

// Still assumes array of numbers
Array.prototype.average = function() {
  return this.sum()/this.length;
}

// var led = new arduino.Led({
//   board: board,
//   pin: 13
// });

// led.blink();


var button = new arduino.Button({
  board: board,
  pin: "12"
});

button.on('down', function(){
  increment_vid();
  console.log('BOOM');
});

button.on('up', function(){

});

// handle the light sensors as input pins
for (var i = 0; i < light_ports.length; i++) {
  board.pinMode(light_ports[i], 'in');
}

board.on('data', function(m){
  var splitdata = m.split(':');
  for (var i = 0; i < light_ports.length; i++) {
    if (splitdata[0] == light_ports[i]) {
      var light = Number(splitdata[splitdata.length - 1]);
      if (light_array_array[i].length < size_light_array) {
        light_array_array[i].push(light);
      } else {
        //console.log("light average:", light_array_array[i].average());
        if (light > light_threshold_fraction * light_array_array[i].average()) {
          console.log("HHHHHHHHHHHHHEEEEEYYYYYY WALKER HERE AT " + i);
          update_time_walked(i);
          //send_open_graph_request();
        }
        light_array_array[i].push(light);
        light_array_array[i].shift();
      }
      //console.log(light_array_array[i]);
    }
  }
});

setInterval(function(){
  // console.log(button.down);
  for (var i =0; i < light_ports.length; i++) {
    board.analogRead(light_ports[i]);
  }
}, check_period);

function increment_vid() {
  var options = {
    host: 'thepaulbooth.com:3031',
    path: '/next/' + current_vid
  };

  http.get(options, function(res) {
    var output = '';
    res.on('data', function (chunk) {
        output += chunk;
    });

    res.on('end', function() {
      var server_data = JSON.parse(output);
      var user = server_data.user;
      var vid = server_data.vid;
      current_vid = vid;
      if (user && user.name) {
        console.log("Currently logged in as " + user.name);
      }
    });
  }).on('error', function(e) {
    console.log('ERROR: ' + e.message);
  });
}

// updates the time since the light was interrupted, maybe causing an OG request
function update_time_walked(i) {
  var d = new Date();
  light_port_times[i] = d.getTime();
  // even versus odd - going in versus out.
  if (i % 2 == 0) {
    console.log("Time since partner:" + (light_port_times[i] - light_port_times[i+1]))
    if (light_port_times[i+1] && light_port_times[i] - light_port_times[i+1] < DOOR_THRESHOLD_TIME) {
      console.log("ENTERING");
      send_open_graph_request(true); // we must be going into the room
    }
  } else {
    console.log("Time since partner:" + (light_port_times[i] - light_port_times[i-1]))
    if (light_port_times[i-1] && light_port_times[i] - light_port_times[i-1] < DOOR_THRESHOLD_TIME) {
      send_open_graph_request(false); // we must be leaving the room
      console.log("LEAVING");
    }
  }
}

// sends an open graph request to the current vid
// entering_room is boolean for entering or leaving a room
function send_open_graph_request(entering_room) {
  console.log("making a request with vid:" + current_vid);
  var options = {
    host: 'thepaulbooth.com',
    port: 3031,
    path: '/personwalkedinto/' + encodeURIComponent(room_name) + '?user_id=' + current_vid + '&entering_room=' + entering_room
  };

  http.get(options, function(res) {
    var output = '';
    res.on('data', function (chunk) {
        output += chunk;
    });

    res.on('end', function() {
      console.log("output from OG request:");
      console.log(output);
    });
  }).on('error', function(e) {
    console.log('ERROR: ' + e.message);
    console.log(e);
  });
}