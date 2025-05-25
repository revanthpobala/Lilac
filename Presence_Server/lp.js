/*
	Javascript code for the operation of Presence Server in Lilac
	Runs on NodeJS: use command "node /[directory]/lp.js"
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

// nodeServer_address must be pointed to the directory server.
var nodeServer_address = "http://thelilacproject.org";
var http = require('http');
var ioClient = require('socket.io-client');
var Chance = require('chance');
var fs = require('fs');
var os = require('os');
var server = http.createServer(function (req,res) {
	console.log("http://" + host + ":" +server.address().port);
	console.log(os.hostname());
	res.writeHead(200);
	res.end("Hi. You may be looking for thelilacproject.org.\n");
}).listen(process.env.PORT || 8092); // Added fallback port 8092 as an example
var port = server.address().port;
var io = require('socket.io')(server);
var bigInt = require('./BigInt');
var lib = require('./lib');
var sjcl = require('./sjcl');
var RBTree = require('./rbtree');
var base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var count = 0;
var chance = new Chance();
var key_base = 95;
var client =
{
	username: null,
	id: null,
};
var connection =
{
	connection_id: null,
	id: null

};
var identifier =
{
	id: null,
	key: null,
	pid: null,
	encrypt_iv: "////////////",
	decrypt_iv: "AAAAAAAAAAAA",
	queue: [],
	message_array: []
}

function h2s(h)
{
    var ret = "";
    h.replace(/(..)/g,
        function(s)
        {
            ret += String.fromCharCode(parseInt(s, 16));
        });
    return ret;
}

function cmp(a,b) {
	if (a < b) return -1;
	if (a > b) return 1;
	if (a == b) return 0;
}
var clientTreeID = new RBTree(cmp);
var nextClientTreeID = new RBTree(cmp);
var connectionTreeID = new RBTree(cmp);
var nextConnectionTreeID = new RBTree(cmp);
var clientTree = new RBTree(cmp);
var nextClientTree = new RBTree(cmp);
var connectionTree = new RBTree(cmp);
var nextConnectionTree = new RBTree(cmp);
var keyTree = new RBTree(cmp);

function getTimeStamp()
{
	epoch_length = 1000; //epoch length in minutes
	return Math.floor(new Date() / (60000 * epoch_length));
}

var timeStamp = getTimeStamp();

function checkTimeStamp()
{
	if (timeStamp != getTimeStamp())
	{
		timeStamp = getTimeStamp();

		clientTree = nextClientTree;
		nextClientTree = new RBTree(cmp);

		connectionTree = nextConnectionTree;
		nextConnectionTree = new RBTree(cmp);
	}
}

function add_key(socket_id, key)
{
	keyTree.put(socket_id, key);
}

function find_identifier(socket_id)
{
	return keyTree.get(socket_id);
}

function find_key(socket_id)
{
	var identifier = keyTree.get(socket_id);
	if (identifier)
		return identifier.key;
	return null;
}

function add_client(newClient)
{
	clientTreeID.put(newClient.id, newClient.username);
	clientTree.put(newClient.username, newClient);
}

function add_future_client(newClient)
{
	nextClientTreeID.put(newClient.id, newClient.username);
	nextClientTree.put(newClient.username, newClient);
}

function add_connection(newClient)
{
	connectionTreeID.put(newClient.id, newClient.connection_id);
	connectionTree.put(newClient.connection_id, newClient);
}

function add_future_connection(newClient)
{
	nextConnectionTreeID.put(newClient.id, newClient.connection_id);
	nextConnectionTree.put(newClient.connection_id, newClient);
}

function check_presence(username)
{
	return clientTree.get(username);
}

function check_future_presence(username)
{
	return nextClientTree.get(username);
}

function check_connection(username)
{
	return connectionTree.get(username);
}

function check_future_connection(username)
{
	return nextConnectionTree.get(username);
}

function find_client(id)
{
	return clientTree.get(clientTreeID.get(id));
}

function remove_id_presence(id)
{
	keyTree.delete(id);
	var username = clientTreeID.get(id);
	if (username)
	{
		clientTreeID.delete(id);
		clientTree.delete(username);
		count--;
		//console.log(username + " removed. " + count + " users.");

		username = nextClientTreeID.get(id);
		if (username)
		{
			nextClientTreeID.delete(id);
			nextClientTree.delete(username);
		}
	}
    remove_contact_pair(id);
}

function remove_contact_pair(id)
{
	var connection_id = connectionTreeID.get(id);
	if (connection_id)
	{
		connectionTreeID.delete(id);
		connectionTree.delete(connection_id);
		connection_id = nextConnectionTreeID.get(id);
		if (connection_id)
		{
			nextConnectionTreeID.delete(id);
			nextConnectionTree.delete(connection_id);
		}
	}
}

function prepare_for_home(type, content, client)
{
	var return_data = {type: type, x: content};
	return_data = JSON.stringify(return_data);
	return_data = encrypt_for_client(return_data, client);
	return_data = {x: return_data};
	client.queue.push({event: 'x', data: return_data});
	return return_data;
}

function getSpam()
{
	var data = chance.string({length: 140, pool: '0123456789abcdef'});
	var key = chance.string({length: 64, pool: '0123456789abcdef'});
	data = encrypt_simple(data, key);
	data = {x: data};
	return {event: "q", data: data};
}
// This is a heartbeat function please comment it to get rid of the heart beat
// messages from the connected relays.

function heartbeat()
{
	var fn = function(key, val)
	{
		var queue = val.queue;
		var msg = (typeof queue != "undefined" && queue != null && queue.length > 0) ? queue.shift() : getSpam();
	var skt = io.sockets.sockets.get(val.id);
		if (skt)
		{
			if (msg.event && msg.data)
				skt.emit(msg.event, msg.data);
		}
	}

	keyTree.inorder(fn, false);
}

function padLeadingZeroes(str, len){
	var zeroes = len - str.length;
	pad = "";
	while (zeroes > 0)
	{
		pad += "0";
		zeroes--;
	}
	return pad + str;
}

function base16toHigh(str){
	var bInt = bigInt.str2bigInt(str, 16);
	return bigInt.bigInt2str(bInt, key_base);
}

function baseHighto16(str){
	var bInt = bigInt.str2bigInt(str, key_base);
	return padLeadingZeroes(bigInt.bigInt2str(bInt, 16), 64).toLowerCase();
}

function increment_base64(a){
	_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var i = a.length-1;
	var return_string = "";
	while (i > -1)
	{
		var val = _chars.indexOf(a.charAt(i));
		if (val != 63){
			return_string = a.slice(0, i) + _chars[val+1] + return_string;
			i = -1;
		}
		else {
			return_string = _chars[0] + return_string;
			i--;
		}
	}
	return return_string;
}

function decrement_base64(a){
	_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var i = a.length-1;
	var return_string = "";
	while (i > -1)
	{
		var val = _chars.indexOf(a.charAt(i));
		if (val != 0){
			return_string = a.slice(0, i) + _chars[val-1] + return_string;
			i = -1;
		}
		else {
			return_string = _chars[63] + return_string;
			i--;
		}
	}
	return return_string;
}

function strip(a){
	a = JSON.parse(a);
	return a.ct+","+a.salt;
}

function strip_simple(a){
	a = JSON.parse(a);
	return a.ct+","+a.salt+","+a.iv;
}

function dress(s, iv){
	s = s.split(",");
	a = {};
	a.v = 1;
	a.iter = 1000;
	a.ks = 128;
	a.ts = 64;
	a.mode = "gcm";
	a.adata = "";
	a.cipher = "aes";
	a.ct = s[0];
	a.salt = s[1];
	a.iv = iv;
	a = JSON.stringify(a);
	return a;
}

function encrypt_simple(msg, sID)
{
	var encrypted = sjcl.encrypt(sID, msg, {mode : "gcm"});
	return strip_simple(encrypted);
}

function decrypt(msg, sID, IV)
{
	msg = dress(msg, IV);
	return sjcl.decrypt(sID, msg);
}

function encrypt(msg, sID, IV)
{
	var encrypted = sjcl.encrypt(sID, msg, {mode : "gcm", iv: IV});
	return strip(encrypted);
}

function decrypt_from_client(msg, client)
{
	var sID = client.key;
	var IV = client.decrypt_iv;
	var return_data = decrypt(msg, sID, IV);
	client.decrypt_iv = increment_base64(IV);
	return return_data;
}

function encrypt_for_client(msg, client)
{
	var sID = client.key;
	var IV = client.encrypt_iv;
	var return_data = encrypt(msg, sID, IV);
	client.encrypt_iv = decrement_base64(IV);
	return return_data;
}

function array_is_full(arr){
	var len = arr.length;
	for (var i = 0; i < len; i++)
	{
		if (!(i in arr))
		{
			return false;
		}
	}
	return true;
}

/**
 * Returns a Curve 25519 private/public key pair
 *
 * @return key_pair object containing publicKey and privateKey attributes
 */
function get_key_pair()
{
	var privKey = chance.string(
    {
        length: 64,
        pool: '0123456789abcdef'
    });
    var pubKey = lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(privKey)), lib.curve25519_nine())));
	var key_pair = {
		privateKey: privKey,
		publicKey: pubKey,
	};
	return key_pair;
}

//get my local address
var host;
var localAddress;
/*
var ifaces = os.networkInterfaces();
for (var dev in ifaces) {
    var iface = ifaces[dev].filter(function(details) {
        return details.family === 'IPv4' && details.internal === false;
    });
    if(iface.length > 0) host = iface[0].address;
}
localAddress = "http://" + host + ":" + port;

var nodeServer = ioClient(nodeServer_address,
{
	'forceNew': true
});
var presenceData = {address: localAddress};
nodeServer.emit('register_presence_server', presenceData);
*/
// The below code is to get the address from Amazon ec2 servers. It uses
// update_ip.sh to get the public IP address.

fs.readFile('public-ipv4', 'utf8', function(err, data) {
	if (err) console.log(err);
	else {
		host = data.trim();
		//connect to node server
		localAddress = "http://" + host + ":" + port;
		var nodeServer = ioClient(nodeServer_address,
		{
			'forceNew': true
		});
		var presenceData = {address: localAddress};
		nodeServer.emit('register_presence_server', presenceData);
	}
});


io.sockets.on('connection', function(socket)
{
	//console.log('client connected');

	socket.on('x', function(data)
	{
		if (data.hasOwnProperty('x'))
    	{
    		var currentIdentifier = find_identifier(socket.id);
			if (currentIdentifier == null)
			{
				if (data.type == 'gx presence server')
				{
					data = data.x;
					if (data.hasOwnProperty('gx1') && data.hasOwnProperty('gx2') && data.hasOwnProperty('pid'))
					{
						gx1 = baseHighto16(data.gx1);
						gx2 = baseHighto16(data.gx2);
						var serverek = get_key_pair();
						var serverpky = get_key_pair();
						var gy = serverpky.publicKey;
						var csecret1 = bigInt.str2bigInt(lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(serverek.privateKey)), lib.curve25519_from8bitString(h2s(gx1))))), 16, 64);
						var csecret2 = bigInt.str2bigInt(lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(serverpky.privateKey)), lib.curve25519_from8bitString(h2s(gx2))))), 16, 64);
						var sfinal = bigInt.bigInt2str(bigInt.mult(csecret1, csecret2), 16);
						var sessionid = sfinal;
						var newIdentifier = Object.create(identifier);
						newIdentifier.id = socket.id;
						newIdentifier.key = sessionid;
						newIdentifier.pid = data.pid;
						newIdentifier.message_array = [];
						add_key(socket.id, newIdentifier);
						data =
						{
							gb: base16toHigh(serverek.publicKey),
							gy: base16toHigh(gy)
						};
						data = {type: 'gy presence server', x: data};
						data = JSON.stringify(data);
						data = encrypt_simple(data, gx1);
						data = {x: data};
						socket.emit('x', data);
						//.queue.push({event: 'x', data: data});
					}
				}
			}
			else
			{
				var key = currentIdentifier.key;
				var pid = currentIdentifier.pid;
				try {
					data = decrypt_from_client(data.x, currentIdentifier);
				} catch (err) {
					return; //Error decrypting, most likely because of cover traffic
				}
				try {
					//try parse the data straigh away
					var temp = JSON.parse(data);
					data = temp;
				} catch (err) {
					//else it is a split message
					//handle current piece of the message
					var current_index = base64_chars.indexOf(data.charAt(0));
					var message_length = base64_chars.indexOf(data.charAt(1));
					var current_message = data.substring(2);
					//if it the last piece we need to remove any padding
					if ((current_index + 1) == message_length)
					{
						current_message = current_message.substring(0, current_message.lastIndexOf("}") + 1);
					}
					currentIdentifier.message_array[current_index] = current_message;
					//if we have received all the pieces we can stitch them and carry on
					if ((currentIdentifier.message_array).length == message_length && array_is_full(currentIdentifier.message_array))
					{
						data = (currentIdentifier.message_array).join("");
						currentIdentifier.message_array.length = 0;
						try {
							//now try parsing the stitched data
							data = JSON.parse(data);
						} catch (err) {
							//could not parse
							return;
						}
					}
					//else we stop and wait for more pieces
					else
					{
						return;
					}
				}
				var type = data.type;
				data = data.x;
				if (type != 'x') console.log(type);
				switch(type)
				{
					case 'register presence':
						checkTimeStamp();
						if (check_presence(data.username1) == null)
						{
							var newClient = Object.create(client);
							newClient.username = data.username1;
							newClient.id = socket.id;
							add_client(newClient);
							count++;
							console.log(data.username1 + "added. " + count + " users.");
							var sendData = { result: true };
							sendData = prepare_for_home('presence registered', sendData, currentIdentifier);
							socket.emit('x', sendData);
							//queue
							if (check_future_presence(data.username2) == null)
							{
								var newClient = Object.create(client);
								newClient.username = data.username2;
								newClient.id = socket.id;
								add_future_client(newClient);
							}
						}
						else
						{
							var sendData = { result: false };
							sendData = prepare_for_home('presence registered', sendData, currentIdentifier);
							socket.emit('x', sendData);

						}
						break;
					case 'request connection':
						checkTimeStamp();
						console.log("Connection request received for " + data.username + ".");
						var username = data.username;
						var myClient = check_presence(username);
						if (myClient)
						{
							console.log(myClient.username + " found.");
							var tempClient = io.sockets.sockets.get(myClient.id);
							var currentIdentifier = find_identifier(myClient.id);
							var sendData =
							{
								username : data.myusername,
								gb: data.gb,
								gy: data.gy,
								address : data.address,
								Xpid : pid
							}
							sendData = prepare_for_home('connection requested', sendData, currentIdentifier);
							tempClient.emit('x', sendData);
						}
						break;
					case 'request private connection':
						checkTimeStamp();
						remove_contact_pair(socket.id);
						var myClient = check_connection(data.username1);
						if (myClient == null)
						{
							var newConnection = Object.create(connection);
							newConnection.connection_id = data.username1;
							newConnection.id = socket.id;
							add_connection(newConnection);
							if (check_future_connection(data.username2) == null)
							{
								var newConnection = Object.create(connection);
								newConnection.connection_id = data.username2;
								newConnection.id = socket.id;
								add_future_connection(newConnection);
							}
						}
						else
						{
							if (socket.id != myClient.id)
							{
								console.log(myClient.connection_id + " found.");
								var tempClient = io.sockets.sockets.get(myClient.id);
								var currentIdentifier = find_identifier(myClient.id);
								var sendData =
								{
									username : data.username1,
									gb: data.gb,
									gy: data.gy,
									address : data.address,
									Xpid : pid
								}
								sendData = prepare_for_home('connection requested', sendData, currentIdentifier);
								tempClient.emit('x', sendData);
								remove_contact_pair(myClient.id);
							}
						}
						break;
				}
			}
    	}
	});

	socket.on('disconnect', function()
    {
        //console.log('client disconnected');
        remove_id_presence(socket.id);
    });
});
// Comment the below line to get rid of heartbeat messages.
setInterval(heartbeat, 5000); //heartbeat interval length in milliseconds
