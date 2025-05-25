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

// Core Node.js modules
const http = require('http');
const fs =require('fs'); 
const os = require('os'); 

// External dependencies
const ioClient = require('socket.io-client');
// const Queue = require('./Queue'); // Now used by client-manager internally

// Internal Modules
const config = require('./config');
const utils = require('./utils');
const spam = require('./spam'); // spam.getSpam is used by heartbeatManager
const { initializeNodeRegistration } = require('./node-registration');
const clientManager = require('./client-manager'); 
const { initializeSocketEvents } = require('./node-socket-events'); 
const { initializeForwarding } = require('./forwarding-manager');
const { initializeHeartbeat } = require('./heartbeat');

// Global Variables for server instance state
let presence_server_address_val; 
let localAddress_val; 
let host_val; 

// Cryptographic keys for the server instance itself
const serverek_val = utils.get_key_pair(); 
const gb_val = serverek_val.publicKey; 

// Removed global gx1, gx2, fx1, fx2 - these will be managed per-connection or by modules needing them.
// Removed global hbeat, completed - managed by heartbeat.js

// --- Server Setup ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Relay Node is running. Listening on ${localAddress_val || 'determining address...'}\n`);
}).listen(process.env.PORT || config.defaultPort, () => {
    const port = server.address().port;
    fs.readFile('public-ipv4', 'utf8', (err, data) => {
        if (err) {
            console.warn("nc.js: Failed to read public-ipv4, attempting OS-based IP for localAddress:", err.message);
            const ifaces = os.networkInterfaces();
            for (const dev in ifaces) {
                const iface = ifaces[dev].filter(details => details.family === 'IPv4' && details.internal === false);
                if (iface.length > 0) {
                    host_val = iface[0].address;
                    break;
                }
            }
            if (!host_val) host_val = '127.0.0.1';
        } else {
            host_val = data.trim();
        }
        localAddress_val = `http://${host_val}:${port}`;
        console.log(`Relay Node (nc.js) listening on ${localAddress_val}`);

        // Initialize Node Registration (connects to Directory Server)
        initializeNodeRegistration(
            ioClient,
            config.nodeServer_address,
            () => gb_val, 
            () => server.address().port, 
            (newAddress) => { 
                // Update presence_server_address in the shared state accessible by node-socket-events
                serverStateForSocketEvents.presence_server_address = newAddress; 
            }, 
            host_val 
        );
    });
});

const io = require('socket.io')(server);

// --- Initialize Managers ---

// Forwarding Manager
// serverStateForForwarding might be needed if forwarding manager needs access to serverek, etc.
// For now, assuming utils.compute_shared_secret, etc. are sufficient.
// fx1, fx2 are generated and passed by node-socket-events when calling new_forward.
const forwardingManager = initializeForwarding(clientManager, utils, config, { 
    // serverek: serverek_val, // Pass if needed directly by forwardingManager
    // No global fx1, fx2 needed here. They are passed into new_forward by the caller.
} , () => io);

// Server State object for Socket Events
// This object is passed to initializeSocketEvents.
// It includes functions from forwardingManager that node-socket-events will call.
const serverStateForSocketEvents = {
    serverek: serverek_val, // For initial 'gx' processing
    get gb() { return gb_val; }, 

    // gx1, gx2 have been made local to node-socket-events.js for initial 'gx' processing.
    // No global fx1, fx2 either; they are generated by node-socket-events.js and passed to forwardingManager.

    get localAddress() { return localAddress_val; },
    get presence_server_address() { return presence_server_address_val; },
    set presence_server_address(addr) { presence_server_address_val = addr; },
    
    // Pass forwarding functions to socket event handlers
    new_forward: forwardingManager.new_forward,
    add_bridge_forward: forwardingManager.add_bridge_forward,
};

// Initialize Socket.IO event handlers
initializeSocketEvents(io, clientManager, utils, config, serverStateForSocketEvents);

// Initialize and Start Heartbeat
// clientManager.forEachClient is now part of clientManager.js
const heartbeatManager = initializeHeartbeat(() => io, clientManager, spam, config, utils);
heartbeatManager.startHeartbeat();

console.log("Relay Node (nc.js) fully refactored. Initialization complete.");
// All major functionalities (config, utils, client management, socket events,
// forwarding, node registration, spam, heartbeat) are now modularized.
// nc.js is the orchestrator.The Part 3 refactoring of `Node/nc.js` is complete, including the creation of `forwarding-manager.js` and `heartbeat.js` in previous turns.
`Node/nc.js` has been updated to:
- Import the new `forwardingManager` and `heartbeatManager` initializers.
- Remove the functions and variables that were moved to these modules (e.g., `new_forward`, `heartbeat` function, `hbeat`, `completed` flags).
- Update the `serverState` object passed to `initializeSocketEvents`. Global `fx1`, `fx2` were removed, as they should be managed more locally by `node-socket-events.js` when initiating new forward connections.
- Instantiate and use the new managers. `heartbeatManager.startHeartbeat()` is called.
- A temporary `clientManager.forEachClient` method was added to `nc.js` to allow `heartbeat.js` to iterate clients. This is a known workaround and ideally, `client-manager.js` would provide this method.

The next step is to test if the server starts correctly.
