var apiKey = '423298101062880';
var secretKey = '3ea916ceaa6675538845a6ad37268692';

var argv = process.argv;
var https = require('https');
var querystring = require('querystring');

// stores the verified_users
var verified_users = [];

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
  var locals = {name: req.session.user.name, verified: check_verified(req.session.user.id)}
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
  var entering_room = req.query["entering_room"];
  var room_image = req.query["room_image"] || 'http://www.classcarpetny.com/wp-content/uploads/2012/03/room.jpg'
  console.log("entering room:" + entering_room);
  console.log(typeof(entering_room));
  if (!req.session.access_token && (user_id == null || verified_users.length == 0)) {
    console.log("NO ACCESS TOKEN AT PERSON WALKED.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  var access_token = req.session.access_token || verified_users[user_id % verified_users.length].access_token;
  var room_name = req.params.room_name;
  console.log("ROOM NAME:" + room_name);
  // we are going to handle the person walking now

  var post_data = querystring.stringify({
    room: "http://thepaulbooth.com:3031/room/" + room_name + '?room_image='+room_image,
    access_token: access_token
  });

  var action_type = (entering_room == 'false') ? 'leave' : 'enter';
  var options = {
    host: 'graph.facebook.com',
    headers: {
      'Content-Length': post_data.length,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    method: 'POST',
    path: '/me/doortracker:' + action_type + '?access_token=' + access_token
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

// checks to see if a fbid is stored already
function check_verified(fbid) {
  for (var i = 0; i < verified_users.length; i++) {
    if (verified_users[i].user.id == fbid) {
      return true;
    }
  }
  return false;
}

// stores the info of the current person as a verified user
app.post('/store_info', function (req, res) {
  console.log("STORING INFO:" + req.session.user.name);
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT store_info.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  verified_users.push({user: req.session.user,  access_token:req.session.access_token});
  res.redirect('/');
});

// removes the info of the current person as a verified user
app.post('/remove_info', function (req, res) {
  console.log("Removing INFO:" + req.session.user.name);
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT store_info.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  for (var i = 0; i < verified_users.length; i++) {
    if (verified_users[i].user.id == req.session.user.id) {
      //verified_users.splice(i,1);
      // if we splice, it will mess up everybody's stuff.
      // we should set this to null, check for null everywhere
      // and have a server-side endpoint for cycling the laptop vid
      i--;
    }
  }
  res.redirect('/');
});

// gets infor on the the next user object for the given current vid
app.get('/next/:vid', function(req, res) {
  vid = parseInt(req.params.vid);
  nvid = vid + 1;
  if (verified_users.length > 0) {
    while (verified_users[nvid] == null) {
      nvid++;
      if (nvid > verified_users.length) {
        nvid = 0;
      }
      if (nvid == vid) {
        // no users found. :(
        if (verified_users[vid]) {
          break;
        }
        res.send(JSON.stringify({vid: 0, user: null}));
        return;
      }
    }
    res.send(JSON.stringify({ user:verified_users[nvid].user, vid: nvid }));
  } else {
    res.send(JSON.stringify({vid: 0, user: null}));
  }
});

// gets the number of verified users
app.get('/numverified', function(req, res) {
  res.send(JSON.stringify(verified_users.length));
});

// url to get a specific room
// each room is an open graph object page
// /room?room_name=Suite400
app.get('/room/:room_name', function(req, res) {
  var room_name = req.params.room_name;
  var room_image = req.query["room_image"] || 'http://www.classcarpetny.com/wp-content/uploads/2012/03/room.jpg';
  res.render('room.jade', {room_name: room_name, room_image: room_image});
});

console.log("starting server");
app.listen(3031);
console.log("that was cool");
