var apiKey = '423298101062880';
var secretKey = '3ea916ceaa6675538845a6ad37268692';

var argv = process.argv;
var https = require('https');


var hostUrl = 'http://thepaulbooth.com:3031';

var express = require('express'),
    app = express();

// For cookies! So each person who connects is not all the same person
var MemoryStore = require('connect').session.MemoryStore;
app.use(express.cookieParser());
app.use(express.session({ secret: "doortracker", store: new MemoryStore({ reapInterval:  60000 * 10 })}));

app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// First part of Facebook auth dance
app.get('/', function(req, res){
  var redirect_url = 'https://www.facebook.com/dialog/oauth?client_id=' + apiKey +
   '&redirect_uri=' + hostUrl + '/perms' +
   '&scope=publish_actions&state=authed'
  // console.log("REDIRECTIN' From /")
  // console.log(redirect_url);
  // console.log("REQUEST HEADERS:" + JSON.stringify(req.headers));
  res.redirect(redirect_url);
});

// Second part of Facebook auth dance
app.get('/perms', function(req, res){
  var state = req.query['state'];
  var code = req.query['code'];
  // console.log("req.query:" + JSON.stringify(req.query))
  // console.log("hit /perms")
  // console.log("Code:");
  // console.log(code);
  if (state == 'authed') {
    console.log('sick. Facebook PERMED us.')
    var redirect_path = '/oauth/access_token?' +
    'client_id=' + apiKey +
    '&redirect_uri=' + hostUrl + '/perms' +
    '&client_secret=' + secretKey +
    '&code=' + code;// + '&destination=chat';
    var options = {
      host: 'graph.facebook.com',
      port: 443,
      path: redirect_path
    };

    https.get(options, function(fbres) {
      // console.log('STATUS: ' + fbres.statusCode);
      // console.log('HEADERS: ' + JSON.stringify(fbres.headers));
      var output = '';
      fbres.on('data', function (chunk) {
          output += chunk;
      });

      fbres.on('end', function() {
        // parse the text to get the access token
        req.session.access_token = output.replace(/access_token=/,"").replace(/&expires=\d+$/, "");

        // console.log("ACCESS TOKEN:" + access_token)
        res.redirect('/basicinfo');
      });
    }).on('error', function(e) {
      console.log('ERROR: ' + e.message);
    });
  } else {
    console.error("WHAT THE HECK WE AREN'T AUTHED?????? %s", state);
  }
});

// Gets the basic user info
app.get('/basicinfo', function(req, res) {
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT Basic info.")
    res.redirect('/'); // go home to start the auth process again
    return;
  }
  var options = {
      host: 'graph.facebook.com',
      port: 443,
      path: '/me?access_token=' + req.session.access_token
    };
  https.get(options, function(fbres) {
    // console.log('CHATSTATUS: ' + fbres.statusCode);
    //   console.log('HEADERS: ' + JSON.stringify(fbres.headers));

      var output = '';
      fbres.on('data', function (chunk) {
          //console.log("CHUNK:" + chunk);
          output += chunk;
      });

      fbres.on('end', function() {
        req.session.user = JSON.parse(output);
        res.redirect('/doortracker');
      });
  });
});

// The page for doortracker
app.get('/doortracker', function(req, res) {
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT DOOR TRACKER.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  var locals = {name: req.session.user.name, access_token: req.session.access_token}
  console.log("user:")
  console.log(JSON.stringify(req.session.user, undefined, 2));
  console.log(req.session.access_token);
  res.render('index.jade', locals);
  //res.send("CHATTING IT UP, " + my_user.name + ", with: <ul><li>" + ONLINE.join('</li><li>') + '</li></ul>');
});

app.get('/personwalkedinto/:room_name', function(req, res) {
  console.log("Hey someone walked!");
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT PERSON WALKED.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  var room_name = req.params.room_name;
  console.log("ROOM NAME:" + room_name);
  // we are going to handle the person walking now

  var options = {
    host: 'graph.facebook.com',
    port: 443,
    method: 'POST',
    path: '/me/doortracker:enter?room=http://thepaulbooth.com:3031/room/' + room_name + '&access_token=' + req.session.access_token
  };

  https.get(options, function(fbres) {
    // console.log('STATUS: ' + fbres.statusCode);
    // console.log('HEADERS: ' + JSON.stringify(fbres.headers));
    var output = '';
    fbres.on('data', function (chunk) {
        output += chunk;
    });

    fbres.on('end', function() {
      console.log(req.session.access_token)
      console.log("HEY WE POSTED PROBABLY");
      console.log(output);
      res.send("okay!");
    });
  }).on('error', function(e) {
    console.log('person walking ERROR: ' + e.message);
  }); 
});

// url to get a specific room
// /room?room_name=Suite400
app.get('/room/:room_name', function(req, res) {
  var room_name = req.params.room_name;
  res.render('room.jade', {room_name: room_name});
});

// we got a button push
app.get('/buttonpush', function(req, res) {
  console.log('trying button  push')
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT button down.")
    req.session.tryingtopushbutton = true;
    res.redirect('/'); // Start the auth flow
    console.log("redirected away!");
    return;
  }
  req.session.tryingtopushbutton = false;
  var locals = {name: req.session.user.name, access_token: req.session.access_token}
  console.log("user:")
  console.log(JSON.stringify(req.session.user, undefined, 2));
  console.log(req.session.access_token);
  var options = {
      host: 'graph.facebook.com',
      port: 443,
      method: 'POST',
      path: '/me/thephantomphacebook:push?button=http://thepaulbooth.com:3000/objects/button.html&access_token=' + req.session.access_token
    };
  https.request(options, function(fbres) {
    // console.log('CHATSTATUS: ' + fbres.statusCode);
    //   console.log('HEADERS: ' + JSON.stringify(fbres.headers));

      var output = '';
      fbres.on('data', function (chunk) {
          //console.log("CHUNK:" + chunk);
          output += chunk;
      });

      fbres.on('end', function() {
        console.log('posted:');
        console.log(output);
      });
      fbres.on('err', function(err) {
        console.log('error');
        console.log(err);
      });
  });
  //res.send("CHATTING IT UP, " + my_user.name + ", with: <ul><li>" + ONLINE.join('</li><li>') + '</li></ul>');
});

// this breaks the server - need an arduino attached to server :(
// app.get('/connect', function(req, res) {

//   var LEDlist = [];

//   var buttonDown = function(){
//     LEDlist[0].setOn();
//     console.log("On!");
//   }

//   var buttonUp = function(){
//     LEDlist[0].setOff();
//   }

//   requirejs(['public/scripts/libs/Noduino', 'public/scripts/libs/Noduino.Serial', 'public/scripts/libs/Logger'], function (NoduinoObj, NoduinoConnector, Logger) {
//     var Noduino = new NoduinoObj({'debug': true, host: 'http://thepaulbooth.com:300'}, NoduinoConnector, Logger);
//     Noduino.connect(function(err, board) {
//       if (err) { return console.log(err); }

//       board.withLED({pin: 13}, function(err, LED) { LEDlist[0] = LED;});
//       board.withAnalogInput({pin:  'A0'}, function(err, AnalogInput) { 
//         AnalogInput.on('change', function(a) {
//           console.log(a);
//           if (a.value == 1023) {
//             //HACK: This is expecting a potentiometer changing signal between 0 and 1023
//             // Button just is an analog input with/without 5V for on/off
//             buttonDown();
//           } else {
//             buttonUp();
//           }
//         });
//       });
//     });
//   });

// });



console.log("starting server");
app.listen(3031);
console.log("that was cool");



