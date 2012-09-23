var apiKey = '423298101062880';
var secretKey = '3ea916ceaa6675538845a6ad37268692';


var arduino = require('duino'),
    board = new arduino.Board({
      debug: false
    });

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

function set_up_light_array(light_value) {
  for (var i = 0; i < light_array.length; i++) {
    light_array[i] = light_value;
  }
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
board.pinMode("A0", 'in');
var button = new arduino.Button({
  board: board,
  pin: "12"
});


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
      }
      light_array.push(light);
      light_array.shift();
    }
    console.log(light_array);
  }
});

button.on('down', function(){
  
  console.log('BOOM');
});

button.on('up', function(){
  
  console.log('DA');
});

setInterval(function(){
  // console.log(button.down);
  board.analogRead("A0");
}, check_period);