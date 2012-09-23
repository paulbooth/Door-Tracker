var apiKey = '423298101062880';
var secretKey = '3ea916ceaa6675538845a6ad37268692';

var argv = process.argv;
var https = require('https');
var querystring = require('querystring');

// stores the access_tokens
var access_tokens = [];

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

// when someone walks into a room, this posts to the FB timeline
app.get('/personwalkedinto/:room_name', function(req, res) {
  console.log("Hey someone walked!");
  var user_id = req.query["user_id"];
  if (!req.session.access_token && user_id == null) {
    console.log("NO ACCESS TOKEN AT PERSON WALKED.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  var room_name = req.params.room_name;
  console.log("ROOM NAME:" + room_name);
  // we are going to handle the person walking now

  var post_data = querystring.stringify({
    room: "http://thepaulbooth.com:3031/room/" + room_name,
    access_token: req.session.access_token
  });

  var options = {
    host: 'graph.facebook.com',
    headers: {
      'Content-Length': post_data.length,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    method: 'POST',
    path: '/me/doortracker:enter?access_token=' + req.session.access_token
  };

  var request = https.request(options, function (response) {
    var str = '';
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      console.log(str);
      res.send(str);
    });
  });
  request.write(post_data);
  request.end();
  
});

// url to get a specific room
// each room is an open graph object page
// /room?room_name=Suite400
app.get('/room/:room_name', function(req, res) {
  var room_name = req.params.room_name;
  res.render('room.jade', {room_name: room_name});
});

console.log("starting server");
app.listen(3031);
console.log("that was cool");
