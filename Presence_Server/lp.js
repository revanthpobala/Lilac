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

const http = require('http');
const ioClient = require('socket.io-client');
const fs = require('fs');
const os = require('os');
const Chance = require('chance'); // For heartbeat's getSpam via dependency
const socketIO = require('socket.io'); // Renamed to avoid conflict with 'io' instance

// Import custom modules
const dataManagement = require('./data-management');
const { initializeSocketIOServer } = require('./socket-handlers');
const { startHeartbeat } = require('./heartbeat');

// Configuration
const nodeServer_address = "http://thelilacproject.org";
const defaultPort = 8092; // Default port if process.env.PORT is not set
const heartbeatInterval = 5000; // ms
const checkTimestampInterval = 60000 * 10; // Example: 10 minutes, original was 1000 * epoch_length

// Server Setup
const server = http.createServer((req, res) => {
    // Basic response for HTTP requests, e.g., from a browser
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("Presence Server is running. Clients connect via Socket.IO.\n");
}).listen(process.env.PORT || defaultPort, () => {
    const port = server.address().port;
    console.log(`Presence Server listening on port ${port}`);
    // Connect to Node Server (Directory Server) after HTTP server is listening
    connectToNodeServer(port);
});

// Main Socket.IO Server Instance
const io = socketIO(server);

// Initialize Socket.IO Handlers
// Pass necessary config or dependencies to socket-handlers
const socketHandlerConfig = {
    // localAddress is determined dynamically in connectToNodeServer
    // If needed by socket-handlers immediately, might need adjustment or getter
    getUserCount: dataManagement.getUserCount, // Example of passing a function from dataManagement
};
initializeSocketIOServer(io, socketHandlerConfig);


// Connect to Node Server (Directory Server)
const connectToNodeServer = (currentPort) => {
    fs.readFile('public-ipv4', 'utf8', (err, data) => {
        let host;
        if (err) {
            console.warn("Failed to read public-ipv4, attempting OS-based IP discovery:", err);
            // Fallback to OS-based IP discovery if public-ipv4 file fails
            const ifaces = os.networkInterfaces();
            for (const dev in ifaces) {
                const iface = ifaces[dev].filter(details => details.family === 'IPv4' && details.internal === false);
                if (iface.length > 0) {
                    host = iface[0].address;
                    break;
                }
            }
            if (!host) {
                console.error("Could not determine host IP address. Presence server registration will likely fail.");
                host = '127.0.0.1'; // Last resort fallback
            }
        } else {
            host = data.trim();
        }

        const localAddress = `http://${host}:${currentPort}`;
        console.log(`Presence Server Address determined as: ${localAddress}`);

        const nodeDirectoryClient = ioClient(nodeServer_address, {
            'forceNew': true
        });

        nodeDirectoryClient.on('connect', () => {
            console.log(`Connected to Node Directory Server: ${nodeServer_address}`);
            const presenceData = { address: localAddress };
            nodeDirectoryClient.emit('register_presence_server', presenceData);
            console.log('Sent presence registration to Node Directory Server.');
        });

        nodeDirectoryClient.on('connect_error', (error) => {
            console.error(`Error connecting to Node Directory Server: ${error.message}`);
        });

        nodeDirectoryClient.on('disconnect', (reason) => {
            console.log(`Disconnected from Node Directory Server: ${reason}`);
            // Optionally, implement reconnection logic here
        });
    });
};

// Start Heartbeat
// The Chance instance is created here and passed to startHeartbeat, which passes it to getSpam
const chanceInstance = new Chance();
startHeartbeat(io, dataManagement.keyTree, chanceInstance, heartbeatInterval);

// Start Timestamp Check
// dataManagement.checkTimeStamp is directly called by setInterval
setInterval(dataManagement.checkTimeStamp, checkTimestampInterval);

console.log("Presence Server initialization sequence complete.");
