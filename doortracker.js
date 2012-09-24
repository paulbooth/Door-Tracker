var room_name = "Shane's room";

var arduino = require('duino'),
    board = new arduino.Board({
      debug: false
    });

var http = require('http');

// stores the verified id for the current user
var current_vid = 0;

// controls the threshold for detecting a walker
// a fraction of the average light that needs to be surpassed
var light_threshold_fraction = 1.1;

// controls the frequency of checking for input
// a time in milliseconds to check
var check_period = 500;

// Stores the number of samples to keep track of
var size_light_array = 10;

// Array to hold the last couple iterations of light values
// so we know if there is a person walking under the light sensor
var light_array = [];

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

// handle the light sensor
board.pinMode("A0", 'in');
board.on('data', function(m){
  var splitdata = m.split(':');
  if (splitdata[0] == "A0") {
    var light = Number(splitdata[splitdata.length - 1]);
    if (light_array.length < size_light_array) {
      light_array.push(light);
    } else {
      console.log("light average:", light_array.average());
      if (light > light_threshold_fraction * light_array.average()) {
        console.log("HHHHHHHHHHHHHEEEEEYYYYYY WALKER HERE");
        send_open_graph_request();
      }
      light_array.push(light);
      light_array.shift();
    }
    console.log(light_array);
  }
});

setInterval(function(){
  // console.log(button.down);
  board.analogRead("A0");
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

// sends an open graph request to the current vid
function send_open_graph_request() {
  console.log("making a request with vid:" + current_vid);
  var options = {
    host: 'thepaulbooth.com',
    port: 3031,
    path: '/personwalkedinto/' + room_name + '?user_id=' + current_vid
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
  });
}