/*
	Javascript code for the operation of relays in Lilac
	Runs on NodeJS: use command "node /[directory]/nc.js"
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
// Port is optional. To avoid conflict this server chooses random port that is
// available.
var port =8091;
//The presence server is where users register their usernames or chat partner.
//Its address is sent dynamically from the node server
//The presence server is where users register their usernames or chat partner.
//Its address is sent dynamically from the node server
var presence_server_address;
//The node server is where nodes register presence so users know they are online.
//It also sends the node the address of the current presence server.
//The address of the node server is fixed. It should always point to the Directory
//Server
var nodeServer_address = "http://thelilacproject.org";
var ioClient = require('socket.io-client');
var Chance = require('chance');
var bigInt = require('./BigInt');
var RBTree = require('./rbtree');
var lib = require('./lib');
var sjcl = require('./sjcl');
var Queue = require('./Queue');
var http = require('http');
var fs = require('fs');
var os = require('os');
var server = http.createServer(function(req, res)
{
    console.log(host + ":" +server.address().port);
    // Change process.env.PORT to port to run the server on the specified port
}).listen(process.env.PORT);
var io = require('socket.io')(server);
var base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
// DO NOT CHANGE THESE VALUES. CHANGE OF THIS VALUES RESULT IN INCONSISTIENCIES. 
var fixed_data_size = 365;
var guard_data_size = 256;
var middle_data_size = 160;
var exit_data_size = 88;
//Skeleton for all clients which connect to the server.
//Bridge clients also have a "pid" attribute added to them.
function clientPrototype () {
    this.id = null;
    this.next = null; //this is the connection to the next relay in the circuit
    this.sID = null;
    this.client = false;
    this.server = false;
    this.bridge = false;
    this.decrypt_iv = "AAAAAAAAAAAA";
    this.encrypt_iv = "////////////";
    this.queue = new Queue.Queue(); //this is the queue of messages to be sent backwards towards the user
    this.message_array = [];
    this.node_key = null;
    this.encrypt_node_iv = "////////////";
    this.decrypt_node_iv = "AAAAAAAAAAAA";
}
//var next = null;
//var socket, client;
var chance = new Chance();

var key_base = 95;
//console.log(port);

var hbeat = 'true';
var interval = 300;
//Simple comparison function necessary for Red black tree implementation
function cmp(a,b) {
	if (a < b) return -1;
	if (a > b) return 1;
	if (a == b) return 0;
}

var clientTree = new RBTree(cmp); //Red black tree for all clients, identified by their socket ID
var pidTree = new RBTree(cmp); //Red black tree to quickly get the socket ID of a bridge client when we have its PID.
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
//need to have try catch block
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
	var sID = client.sID;
	var IV = client.decrypt_iv;
	var return_data = decrypt(msg, sID, IV);
	client.decrypt_iv = increment_base64(IV);
	return return_data;
}

function encrypt_fix_IV(msg, key)
{
	var sID = key;
	var IV = "AAAAAAAAAAAA";
	return encrypt(msg, sID, IV);
}

function decrypt_fix_IV(msg, key)
{
	var sID = key;
	var IV = "AAAAAAAAAAAA";
	return decrypt(msg, sID, IV);
}
// INGNORE THE COMMENTED FUNCTIONS
/*function encrypt_gx(msg, key)
{
	var sID = key;
	var IV = "AAAAAAAAAAAA";
	return encrypt(msg, sID, IV);
}

function decrypt_gx(msg)
{
	var sID = serverek.publicKey;
	var IV = "AAAAAAAAAAAA";
	return decrypt(msg, sID, IV);
}

function encrypt_gy(msg)
{
	var sID = serverek.publicKey;
	var IV = "AAAAAAAAAAAA";
	return encrypt(msg, sID, IV);
}

function decrypt_gy(msg, key)
{
	var sID = key;
	var IV = "AAAAAAAAAAAA";
	return decrypt(msg, sID, IV);
}*/
// DO NOT FUCKING TOUCH THIS.
function encrypt_for_client(msg, client)
{
	var sID = client.sID;
	var IV = client.encrypt_iv;
	var return_data = encrypt(msg, sID, IV);
	client.encrypt_iv = decrement_base64(IV);
	return return_data;
}

function decrypt_from_node(msg, client)
{
	var sID = client.node_key;
	var IV = client.decrypt_node_iv;
	var return_data = decrypt(msg, sID, IV);
	if (client.hasOwnProperty('initiator'))
		client.decrypt_node_iv = decrement_base64(IV);
	else
		client.decrypt_node_iv = increment_base64(IV);
	return return_data;
}

function encrypt_for_node(msg, client)
{
	var sID = client.node_key;
	var IV = client.encrypt_node_iv;
	var return_data = encrypt(msg, sID, IV);
	if (client.hasOwnProperty('initiator'))
		client.encrypt_node_iv = increment_base64(IV);
	else
		client.encrypt_node_iv = decrement_base64(IV);
	return return_data;
}

/**
 * Traverses the client RB tree return the client with the matching socket id
 *
 * @param id: socket id to be searched for
 *
 * @return client object if found, else null
 */
function find_client(id)
{
	return clientTree.get(id);
}

/**
 * Traverses the pid RB tree and then the client RB tree to return the client with the matching pid
 * We could serch the client tree directly in order to find the client with the matching client ID
 * This implementation with 2 RB trees means 2 searches of O(log n) are necessary, rather than one search of O(n)
 *
 * @param id: pid to be searched for
 *
 * @return client object if found, else null
 */
function find_client_by_pid(id)
{
	return clientTree.get( pidTree.get(id) );
}

/**
 * Adds the given client object to the client RB tree
 * If the client object has a pid attribute, and entry is also added to the pid tree
 *
 * @param newClient: the client to be added
 */
function add_client(newClient)
{
	clientTree.put(newClient.id, newClient);
	if (newClient.pid)
		pidTree.put(newClient.pid, newClient.id);
}

/**
 * Removes a client with the given id from the client RB tree
 * If the client has a pid, the pid entry is removed from the pid RB tree
 *
 * @param id: the id of the client to be removed
 */
function delete_client(id)
{
	var client = find_client(id);
	if (client)
	{
		var pid = client.pid;
		clientTree.delete(id);
		if (pid)
			pidTree.delete(pid);
	}
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

function compute_shared_secret(keypairA, keypairB, pubkeyA, pubkeyB)
{
	var csecret1 = bigInt.str2bigInt(lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(keypairA.privateKey)), lib.curve25519_from8bitString(h2s(pubkeyA))))), 16, 64);
	var csecret2 = bigInt.str2bigInt(lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(keypairB.privateKey)), lib.curve25519_from8bitString(h2s(pubkeyB))))), 16, 64);
	var sfinal = bigInt.bigInt2str(bigInt.mult(csecret1, csecret2), 16);
	return sfinal;
}

/**
 * Converts clear data to be sent back to the client to encrypted generic-looking data
 *
 * @param type: the appropriate data type the client will be receiving
 * @param content: the content being sent
 * @param sID: the AES key to encrypt the data with
 * @return return_data object containing the encrypted object to be sent, paired to the attribute "x"
 */
function prepare_for_home(type, content, client)
{
	var return_data = {type: type, x: content};
	return_data = JSON.stringify(return_data);
	return_data = encrypt_for_client(return_data, client);
	return_data = {x: return_data};
	return return_data;
}

var spamArraySize = 10000;
var spamArray = [spamArraySize];
refillSpam();
var spamLength = spamArray[0].length;

function refillSpam(){
	for (i = 0; i < spamArraySize; i++)
		spamArray[i] = chance.string({length: 682, pool: base64_chars}) + "==," + chance.string({length: 22, pool: base64_chars}) + "==";
}

/**
 * Retrieves generic-looking data to be sent as dummy traffic when no data is waiting to be sent
 *
 * @return return_data object containing the encrypted dummy object to be sent, paired to the attribute "x"
 */
function getSpam()
{
	piece1 = chance.integer({min: 0, max: spamArraySize - 1});
	piece2 = chance.integer({min: 0, max: spamArraySize - 1});
	splt = chance.integer({min: 0, max: spamLength});
	return spamArray[piece1].substring(0,splt) + spamArray[piece2].substring(splt,spamLength);
}

function isValidQueue(queue){
	return (typeof queue != "undefined" && queue != null && queue.getLength() > 0);
}

var completed = true;
/**
 * Traverses the client RB tree to visit each client, and looks in the queues (forward and backward).
 * If data is present in the queue, it sends this to the relevant recipient
 * Id the queue is empty, the getSpam() function is used to generate random data, which is sent instead
 */
function heartbeat()
{
	if (!completed)
		console.log("DID NOT COMPLETE HEARTBEAT");
	completed = false;
	//Implementation 1: Convert to array and go through 160array
	/*
	var i;
	var clientList = clientTree.toArray();
	for (i=0; i<clientList.length; i++)
	{
		if (clientList[i])
		{

		}
	}*/

	//Implementation 2: Directly apply function while traversing tree
	var fn = function(key, val)
	{
		if (val.next)
		{
			var queue = val.next.queue;
			if (hbeat)
			{
				var msg = (isValidQueue(queue)) ? queue.dequeue() : getSpam();
				if (msg.event && msg.data)
					val.next.emit(msg.event, msg.data);
			}
			else {
				if (isValidQueue(queue))
				{
					var msg = queue.dequeue();
					if (msg.event && msg.data)
						val.next.emit(msg.event, msg.data);
				}
			}
			//Heartbeat to server if bridge is connected you can get rid of Heartbeat
      // messages by commenting the below if block.
			if (hbeat && val.serverClient)
			{
				var msg = getSpam();
				val.serverClient.emit(msg.event, msg.data);
			}
		}

		var queue = val.queue;
		if (hbeat)
		{
			var msg = (isValidQueue(queue)) ? queue.dequeue() : getSpam();

			var skt = io.sockets.connected[val.id];
			if (skt)
			{
				if (msg.event && msg.data)
					skt.emit(msg.event, msg.data);
			}
		}
		else {
			if (isValidQueue(queue))
			{
				var msg = queue.dequeue();
				var skt = io.sockets.connected[val.id];
				if (skt)
				{
					if (msg.event && msg.data)
						skt.emit(msg.event, msg.data);
				}
			}
		}
	}

	clientTree.inorder(fn, false);
	completed = true;
}

/**
 * This portion of code deals with the registering this relay to the node server and receiving information from it
 * We need to send three things to the node server:
 * 		1. the ip address of this relay
 * 		2. the port of this server (fixed above)
 *		3. the curve 25519 public key of this relay
 * We connect to the node server and send this information
 * We then add a listener for the node server to reply with the presence server's address
 * We leave this listener active to receive the address of another presence server if this one goes down
 */

//generate my long-term public and private key
var host;
var serverek = get_key_pair();
var gb = serverek.publicKey;
var gx1, gx2;
var fx1, fx2;

//connect to node server
var localAddress;// = "http://" + host + ":" + port;
var host;
var nodeServer;

// Get the IP address from the server.
/*
var ifaces = os.networkInterfaces();
for (var dev in ifaces) {
    var iface = ifaces[dev].filter(function(details) {
        return details.family === 'IPv4' && details.internal === false;
    });
    if(iface.length > 0) host = iface[0].address;
}

localAddress = "https://" + host + ":" + server.address().port;
console.log("My hostname: " + os.hostname());
nodeServer = ioClient.connect(nodeServer_address,
{
  'forceNew': true
});

register_node();

//get presence server address
nodeServer.on('presence server', function(data)
{
  console.log("Presence server address: " + data.presence_server_address);
  presence_server_address = data.presence_server_address;
});

setInterval(register_node, 60000);
*/
// If you are using AWS ec2 servers comment out the below block to get the
// Public IP address. Use update_ip.sh script to get the public ip address.


fs.readFile('public-ipv4', 'utf8', function(err, data){
	if (err)
	{
		console.log(err);
	}
	else {
		host = data.trim();
		localAddress = "http://" + host + ":" + port;
		console.log("My address: " + localAddress);
		nodeServer = ioClient.connect(nodeServer_address,
		{
			'forceNew': true
		});

		register_node();

		//get presence server address
		nodeServer.on('presence server', function(data)
		{
			console.log("Presence server address: " + data.presence_server_address);
			presence_server_address = data.presence_server_address;
		});

		setInterval(register_node, 60000);
	}
});

function register_node() {
	//register myself on the node server
	var nodeData = {host: host, port: server.address().port, pk: gb};
	nodeServer.emit('register_node', nodeData);
}

/**
 * Generates, connects to and returns a new socket.io client to forward data to
 * This function generates all outgoing connections (i.e. extending the circuit)
 * The listeners in this function handle all data coming from forward relays (i.e. data going backwards to the user).
 *
 * @param address: the ip address of the relay to connect to
 * @param ID: the socket id of the client whose forward node this is
 * @param type: the type of relay we are connecting to, special care is needed for 'server' or 'bridge' types
 * @return socket.io client object, which is the next relay in the circuit
 */
function new_forward(address, ID, type)
{
	var client = ioClient.connect(address,
    {
        'forceNew': true
    });
    client.pid = ID;
    client.queue = new Queue.Queue();
    client.node_key = null;
    client.node_key_established = false;
    client.encrypt_node_iv = "AAAAAAAAAAAA";
    client.decrypt_node_iv = "////////////";
    //listener needed to relay generic data back to the user
    client.on("x", function(data)
    {
    	var myClient = find_client(this.pid);
    	if (myClient)
    	{
			if (this.node_key_established)
			{
				try{
					data = remove_padding(data, this);
				} catch (e) {
					//console.log("Exception\n" + e);
					return;
				}
			}
			else
			{
				try{
					data = decrypt_fix_IV(data.x, this.node_key);
					data = JSON.parse(data);
					if (data.type == 'gy')
					{
						data = data.x;
						var gy = baseHighto16(data.gy);
						this.node_key = compute_shared_secret(fx1, fx2, this.node_key, gy);
						this.node_key_established = true;
						data = {type: 'gy', x: data};
						data = {x: JSON.stringify(data)};
					}
				} catch (e) {
					//console.log("Exception\n" + e);
					//console.trace();
					return;
				}
    		}
    		data.x = encrypt_for_client(data.x, myClient);
			data = add_padding(data, myClient);
			//console.log("Data going backwards: " + data.x.length);
			myClient.queue.enqueue({event: 'x', data: data});
    	}
    });

   	//a disconnection from a forward client
   	client.on('disconnect', function()
    {
        //console.log('forward disconnected');
        var myClient = find_client(this.pid);
        if (myClient)
        {
        	if (myClient.bridge || myClient.server)
        	{
        		var c = io.sockets.connected[this.pid];
        		if (c)
    			{
    				//console.log('disconnecting backward');
        			c.disconnect();
    			}
    			delete_client(myClient.id);
        	}
        	else
        	{
        		myClient.serverClient = null;
        	}
        }
    });

    //Add/remove specific listeners for node connected to presence server and bridge
    switch (type)
    {
    	case 'server':
    		add_server_listeners(client);
    		break;
		case 'bridge':
			add_bridge_listeners(client);
			break;
    }
	return client;
}

/**
 * Adds & removes specific listeners of a connection to a presence server
 *
 * @param client: the socket.io client object to be operated on
 */
function add_server_listeners(client)
{
	client.removeAllListeners('x');
	client.on("x", function(data)
    {
    	var myClient = find_client(this.pid);
    	if (myClient.server)
    	{
    		data.x = encrypt_for_client(data.x, myClient);
    		data = add_padding(data, myClient);
    		myClient.queue.enqueue({event: 'x', data: data});
    	}
    });
}

/**
 * Removes specific listeners of a connection to a bridge
 *
 * @param client: the socket.io client object to be operated on
 */
function add_bridge_listeners(client)
{
	client.removeAllListeners('x');
   	client.removeAllListeners('disconnect');
}

/**
 * Authenticates a socket when an type of message is received which should only be received from bridges
 *
 * @param socket: the socket.io object to from where the message originated from
 * @return a client object if the socket is authenticated, else null
 */
function authenticate_bridge(socket)
{
	var myClient = find_client(socket.id);
	if (myClient)
		myClient = find_client(myClient.pid);
	return myClient;
}

/**
 * Creates a client object based on the input parameters, and calls the add_client function to add this client to the client RB tree
 * Performs operations specific to bridge clients before adding to the client RB tree
 *
 * @param socket_id: the socket.id of the new client to be added
 * @param pid: the socket.id of the client which is used to pass data to the user who owns this circuit
 */
function add_bridge(socket_id, pid)
{
	var newClient = new clientPrototype();
	newClient.id = socket_id;
	newClient.bridge = true;
	newClient.pid = pid;
	add_client(newClient);
}

/**
 * Calls the add_forward function to create a new forward relay
 * Performs bridge-specific operations to the client and adds the new forward relay to it.
 *
 * @param myClient: the client which will be associated with the newly connected relay
 * @param address: the ip address of the relay to connect to
 * @param socket_id: the socket.id of the bridge client which connected to this relay
 */
function add_bridge_forward(myClient, data_address, socket_id)
{
	client = new_forward(data_address, socket_id, 'bridge');
	myClient.serverClient = myClient.next;
	myClient.next = client;
	myClient.bridge = true;
	myClient.server = false;
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

var delimiter = '!';
var text_length = 504;

function add_padding(data, myClient)
{
	if ((!myClient.hasOwnProperty('client')) || (/*myClient.hasOwnProperty('client') && */!myClient.client))
	{
		//add delimiter and padding to data.x
		data.x += '!';
		var padding_length = text_length - data.x.length;
		if (padding_length > 0)
			data.x += chance.string({ length: padding_length, pool: base64_chars });
		//encrypt using inter-node secret
		data.x = encrypt_for_node(data.x, myClient);
	}
	return data;
}

function remove_padding(data, myClient)
{
	if ((!myClient.hasOwnProperty('client')) || (/*myClient.hasOwnProperty('client') && */!myClient.client))
	{
		//decrypt using inter-node secret
		data.x = decrypt_from_node(data.x, myClient);
		//remove delimiter and padding from data.x
		data.x = data.x.substring(0, data.x.lastIndexOf("!"));
	}
	return data;
}

/*
 * The rest of the code handles incoming connections
 * 7 types of messages can be accepted:
 * 		1. x
 *		2. connection accepted
 *		3. connect bridge
 *		4. disconnect
 * All of these have some sort of authentication checks, barring the first (partially).
 * Messages 2 & 3 are solely for establishing the "bridge" between two exit nodes
 * Message 4 is for handling disconnects
 */
io.sockets.on('connection', function(socket)
{
    //console.log('client connected');

    /*
     * This listener will handle most traffic between the user and the exit node
     * All data received is encrypted under the attribute "x". We check for the presence of this first.
     *
     * Next we check if we recognize the client.
     * If we don't, we assume this new client is trying to extend the circuit. and as long as the appropriate values are present, we let them
     *
     * If we recognise the client:
     *  We first check to see if the receiving relay is an exit relay which is connected to another exit relay.
     *  	If it is, this is a message from the chat partner and we pass it down the circuit to the user.
     *  If not, we then attempt to decrypt the data with the corresponding AES key.
     * 		If the decryption fails, we exit
     * 		Else, we look at the type of message we are receiving.
     *		All nodes can receive 'x' messages (to pass down the circuit) and 'gx' (to establish a symmetric key)
     *		Only non-exit nodes only should receive 'next-node' messages (to extend the circuit)
     * 		'register presence', 'request connection' and 'request private connection' should only be received by the exit node
     *			These are for communicating with the presence server
     *		'start chat' and 'end conversation' should also only be received by the exit node
     */
    socket.on('x', function(data)
    {
    	if (data.hasOwnProperty('x'))
    	{
			var myClient = find_client(socket.id);
			if (myClient == null)
			{
				if (data.hasOwnProperty('x'))
				{
					//Expecting gx from new client
					try {
						//try decrypt with our public key
						data = decrypt_fix_IV(data.x, serverek.publicKey);
						//console.log("gx decrypted: \n" + data);
						//remove data pertaining to message splitting and padding
						data = data.substring(2, data.lastIndexOf("}") + 1);
						//console.log("gx stripped: \n" + data);
						//parse the data
						data = JSON.parse(data);
						//we are only expecting gx messages at this point
						if (data.type != 'gx') return;
						data = data.x;
					} catch (err) {
						//console.log("heartbeat");
						return;
					}
					if (data.hasOwnProperty('gx1') && data.hasOwnProperty('gx2'))
					{
						gx1 = baseHighto16(data.gx1);
						gx2 = baseHighto16(data.gx2);
						var serverpky = get_key_pair();
						//var privKey = serverpky.privateKey;
						var gy = serverpky.publicKey;
						var sessionid = compute_shared_secret(serverek, serverpky, gx1, gx2);
						var newClient = new clientPrototype();
						newClient.id = socket.id;
						newClient.sID = sessionid;
						if (data.hasOwnProperty('client'))
						{
							newClient.client = data.client;
						} else {
							newClient.client = false;
						}
						if (!newClient.client && data.hasOwnProperty('f1') && data.hasOwnProperty('f2'))
						{
							var f1 = baseHighto16(data.f1);
							var f2 = baseHighto16(data.f2);
							newClient.node_key = compute_shared_secret(serverek, serverpky, f1, f2);
						}
						newClient.next = null;
						add_client(newClient);
						data = {gy: base16toHigh(gy)};
						data = {type: 'gy', x: data};
						data = JSON.stringify(data);
						data = encrypt_fix_IV(data, serverek.publicKey);
						data = {x: data};
						newClient.queue.enqueue({event: 'x', data: data});
					}
				}
			}
			else
			{
				if (myClient.bridge && myClient.pid)
				{
					myClient = authenticate_bridge(socket);
					if (myClient)
					{
						try {
							//console.log("Bridge key decrypt = " + myClient.next.node_key);
							data = remove_padding(data, myClient.next);
						} catch (e) {
							return; //error due to cover traffic
						}
						data.x = encrypt_for_client(data.x, myClient);
						data = add_padding(data, myClient);
						myClient.queue.enqueue({event: 'x', data: data});
						//console.log("Over the bridge!");
					}
					return;
				}
				try {
					data = remove_padding(data, myClient);
					data = decrypt_from_client(data.x, myClient);
				} catch (err) {
					//console.log("hearbeat");
					return; //Error decrypting, most likely because of cover traffic
				}
				try {
					//try parse the data straight away
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
					myClient.message_array[current_index] = current_message;

					//if we have received all the pieces we can stitch them and carry on
					if ((myClient.message_array).length == message_length && array_is_full(myClient.message_array))
					{
						data = (myClient.message_array).join("");
						myClient.message_array.length = 0;
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
				switch(type)
				{
					case 'x':
						if (myClient.next)
						{
							data = {x: data};
							//if (!(myClient.bridge || myClient.server))
							if (!myClient.server)
							{
								//if (myClient.bridge)
									//console.log("Bridge key encrypt = " + myClient.next.node_key);
								data = add_padding(data, myClient.next);
								//console.log("Data going forward: " + data.x.length);
							}
							myClient.next.queue.enqueue({event: 'x', data: data});
						}
						break;
					case 'next-node':
						if (data.hasOwnProperty('address') && data.hasOwnProperty('key'))
						{
							myClient.next = new_forward(data.address, socket.id, 'norm');
							myClient.next.node_key = baseHighto16(data.key);
							data = {type: 'next-node-connected', x: {o: 'o'}};
							data = JSON.stringify(data);
							data = encrypt_for_client(data, myClient);
							data = {x: data};
							data = add_padding(data, myClient);
							myClient.queue.enqueue({event: 'x', data: data});
						}
						break;
					case 'gx':
						if (myClient.next)
						{
							if (myClient.next.node_key_established)
							{
								data = {x: data};
								data = add_padding(data, myClient.next);
							} else {
								fx1 = get_key_pair();
								fx2 = get_key_pair();
								data.f1 = base16toHigh(fx1.publicKey);
								data.f2 = base16toHigh(fx2.publicKey);
								data = {type: "gx", x: data};
								data = "01" + JSON.stringify(data);
								data = encrypt_fix_IV(data, myClient.next.node_key);
								data = {x: data};
							}
							myClient.next.queue.enqueue({event: 'x', data: data});
							myClient.next.initiator = true;
						}
						break;
					case 'gx presence server':
						if (data.hasOwnProperty('gx1') && data.hasOwnProperty('gx2'))
						{
							if (!(myClient.next))
							{
								client = new_forward(presence_server_address, socket.id, 'server');
								myClient.next = client;
								myClient.server = true;
								data.pid = socket.id;
								data = {type: 'gx presence server', x: data};
								myClient.next.queue.enqueue({event: 'x', data: data});
							}
						}
						break;
					case 'start chat':
						if (data.hasOwnProperty('username') && data.hasOwnProperty('gb') && data.hasOwnProperty('gy') && data.hasOwnProperty('address') && data.hasOwnProperty('pid'))
						{
							if (myClient.next)
							{
								if (myClient.server)
								{
									//console.log("start chat");
									add_bridge_forward(myClient, data.address, socket.id);
									data.Xpid = socket.id;
									data.address = localAddress;
									fx1 = get_key_pair();
									fx2 = get_key_pair();
									data.f1 = base16toHigh(fx1.publicKey);
									data.f2 = base16toHigh(fx2.publicKey);
									myClient.next.queue.enqueue({event: 'connection accepted', data: data});
									myClient.next.initiator = true;
								}
							}
					  	}
						break;
					case 'end conversation':
						if (myClient.bridge)
						{
							var parallelClient = find_client_by_pid(socket.id);
							delete_client(parallelClient.id);//remove parallelClient from list
							myClient.bridge = false;
							delete myClient.initator;
							myClient.next.disconnect();
							myClient.next = myClient.serverClient;
							myClient.serverClient = null;
							myClient.server = true;
						}
						break;
				}
			}
		}
    });

    /*
     * The next two listeners are soleley for two exit relays to establish a connection with each other
     * "Connection Accepted" and "Connect Bridge" are used to build the bridge between the 2 exit relays
     * Therefore, these are new connections which need to be authenticated
     * We authenticate these connections by the "pid" attribute which is sent with them
     * If the pid received is the id of an existing exit node, the bridge is established
     * Once the bridge has been created, the rest of the connections can be authenticated using the socket.id of the connection
     */

	//Requested Connection Accepted
	socket.on("connection accepted", function (data)
	{
		//console.log("connection accepted");
		var myClient = null;
    	if (data.hasOwnProperty('pid') && data.hasOwnProperty('Xpid') && data.hasOwnProperty('address') && data.hasOwnProperty('f1') && data.hasOwnProperty('f2'))
    	{
			myClient = find_client(data.pid);
		}
		if (myClient == null)
		{
			//console.log("Unkown message received & ignored");
			return;
		}
		else if (myClient.server)
		{
			add_bridge_forward(myClient, data.address, socket.id);
			var fx1 = get_key_pair();
			var fx2 = get_key_pair();
			var f1 = baseHighto16(data.f1);
			var f2 = baseHighto16(data.f2);
			myClient.next.node_key = compute_shared_secret(fx1, fx2, f1, f2);
			//console.log("Bridge key A = " + myClient.next.node_key);
		    myClient.next.encrypt_node_iv = "////////////";
    		myClient.next.decrypt_node_iv = "AAAAAAAAAAAA";
			var h1 = base16toHigh(fx1.publicKey);
			var h2 = base16toHigh(fx2.publicKey);
			var bridgeData =
			{
				pid: data.Xpid,
				f1: h1,
				f2: h2
			}
			myClient.next.queue.enqueue({event: 'connect bridge', data: bridgeData});
			//myClient.next.emit('connect bridge', bridgeData);
			delete data.pid;
			delete data.Xpid;
			delete data.address;
			delete data.f1;
			delete data.f2;

			add_bridge(socket.id, myClient.id);
			data = prepare_for_home('connection accepted', data, myClient);
			data = add_padding(data, myClient);
			myClient.queue.enqueue({event: 'x', data: data});
			//console.log("bridge connected one-way");
		}
	});

    //Connect Bridge
    socket.on("connect bridge", function(data)
	{
		//console.log("connecting bridge");
    	var myClient = null;
    	if (data.hasOwnProperty('pid'))
    		myClient = find_client(data.pid);
		if (myClient == null)
		{
			//console.log("Unkown message received & ignored");
			return;
		}
		else if (myClient.bridge)
		{
			var f1 = baseHighto16(data.f1);
			var f2 = baseHighto16(data.f2);
			myClient.next.node_key = compute_shared_secret(fx1, fx2, f1, f2);
			//console.log("Bridge key B = " + myClient.next.node_key);
			add_bridge(socket.id, myClient.id);
			//console.log("bridge connected two-ways");
		}
    });

    /*
     * Handling the disconnect cases
     *	1. There is a disconnection felt by the exit node. There are 2 possibilities
     *		a. The middle node of the circuit disconnected with the exit node. We must disconnect with the presence server our chat partner's exit node
     *		b. The exit node of the chat partner has disconnected with us. We must let the user know the conversation is over
     *	2. There is a disconnection felt by the guard or middle node. We must pass on this disconnection to destroy the circuit
     */
    //Disconnection
    socket.on('disconnect', function()
    {
        var myClient = find_client(socket.id);
        if (myClient)
        {
        	//disconnection at bridge
        	if (myClient.bridge)
        	{

        		//console.log("disconnection at bridge");
        		//circuit broken: disconnect from chat partner and presence server
        		if (myClient.next)
        		{
        			//console.log('circuit broken: disconnect from chat partner and presence server');
        			var parallelClient = find_client_by_pid(socket.id);
        			delete_client(parallelClient.id);//remove parallelClient from list
        			//myClient.bridge = false;
    				myClient.next.disconnect();
        			if (myClient.serverClient)
        				myClient.serverClient.disconnect();
					delete_client(myClient.id);//remove myClient from list
        		}
        		//chat partner disconnected
        		else
        		{
					//console.log('chat partner disconnected');
        			var circuitClient = find_client(myClient.pid);
        			delete_client(myClient.id);//remove myClient from list
        			if (circuitClient.next)
        				circuitClient.next.disconnect();
        			circuitClient.next = circuitClient.serverClient;
        			circuitClient.server = true;
        			circuitClient.bridge = false;
					circuitClient.serverClient = null;
					delete circuitClient.initiator;
					data = {o: 'o'};
					data = prepare_for_home('conversation ended', data, circuitClient);
					data = add_padding(data, circuitClient);
					circuitClient.queue.enqueue({event: 'x', data: data});
        		}
        	}

        	//middle node
        	else if (myClient.next)
        	{
        		//console.log("Disconnection from middle node");
				myClient.next.disconnect();
				//remove myClient from list
				delete_client(myClient.id);
        	}
        	else
        		//console.log("Disconnection");
				delete_client(myClient.id); //remove myClient from list
        }
    });

    socket.on('error', function (err) { console.error(err.stack); });
});
setInterval(heartbeat, interval); //heartbeat interval length in milliseconds
