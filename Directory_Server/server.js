/*
	Javascript code for the the Directory server in Lilac
	Runs on NodeJS: use command "node /[directory]/server.js"
  Copyright (c) <2016> <Hussain Mucklai & Revanth Pobala>

  Permission is hereby granted, free of charge, to any person obtaining a copy of
  this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
  OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


var express = require('express');
var app = express();
var fs = require('fs');
var https = require('https');
var port = 8080;
var http = require('http');

// Comment out to get HTTPS.
/* Start Web Server */
/*var options = {
     key: fs.readFileSync('privkey.pem'),
     cert: fs.readFileSync('full-chain.pem'),
     ca: fs.readFileSync('chain.pem')
}*/
var handlerFunction = function (req, res) {
  res.writeHead(200);
}
var host;
var server = http.createServer(app,handlerFunction).listen(process.env.PORT);
var os = require('os');
var ifaces = os.networkInterfaces();
for (var dev in ifaces) {
    var iface = ifaces[dev].filter(function(details) {
        return details.family === 'IPv4' && details.internal === false;
    });
    if(iface.length > 0) host = iface[0].address;
}
localAddress = "https://" + host + ":" +server.address().port;
console.log("listening on " + localAddress);

app.use(function(req, res, next)
{
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
var path = __dirname + '/public';
app.get('/', function(req, res, next)
{
    res.sendFile(path + '/index.html');
});
app.use(express.static(path));

/* End Web Server */

/* Node Server Initialization */

var io = require('socket.io')(server);
var nodes = [];
var creds = [];
var presence_servers = [];
function directoryWrite()
{
	var nodesString = JSON.stringify(creds);
	var file = fs.createWriteStream(path + '/creds.json');
	file.on('error', function(err)
	{
	 	console.log("error while writing to file");
 	});
	file.write(nodesString);
	file.end();
}

function find_node(id)
{
	var len = nodes.length;
	for (var i = 0; i < len; i++)
            if ((nodes[i]).id == id)
            	return i;
	return -1;
}

function find_presence(id)
{
	var len = presence_servers.length;
	for (var i = 0; i < len; i++)
            if ((presence_servers[i]).id == id)
            	return i;
	return -1;
}

/* End Node Server Initialization */

io.sockets.on('connection', function(socket)
{

	socket.on('register_node', function(data)
	{
		var i = find_node(socket.id);
		if (i == -1)
		{
			console.log("node connected");
			var node = {id: socket.id};
			nodes.push(node);
			var n = {host: data.host, port: data.port, publicKey: data.pk};
			creds.push(n);
			directoryWrite();
			var presence_server_data = {presence_server_address: localAddress};
			if (presence_servers.length > 0)
				presence_server_data.presence_server_address = presence_servers[0].address;
			socket.emit('presence server', presence_server_data);
		}
	});

	socket.on('register_presence_server', function(data)
	{
		var tempClient;
		var i = find_presence(socket.id);
		if (i == -1)
		{
			console.log("presence server connected");
			var presence_server = {id: socket.id, address: data.address};
      console.log("Address\t"+data.address);
			presence_servers.push(presence_server);
			if (presence_servers.length == 1)
			{
				var presence_server_data = {presence_server_address: data.address};
				for (i=0; i<nodes.length; i++)
				{
					tempClient = io.sockets.connected[nodes[i].id];
					tempClient.emit('presence server', presence_server_data);
				}
			}
		}
	});

	socket.on('disconnect', function()
	{
		var i = find_node(socket.id);
		if (i != -1)
		{
			nodes.splice(i, 1);
			creds.splice(i, 1);
			directoryWrite();
		}

		i = find_presence(socket.id);
		if (i != -1)
		{
			presence_servers.splice(i, 1);
		}
	});

});
