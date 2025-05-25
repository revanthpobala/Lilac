/*
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

/* Javascript code for the the Directory server in Lilac
	Runs on NodeJS: use command "node /[directory]/server.js" */

const http = require('http');
const os = require('os');
const path = require('path'); // For __dirname

const app = require('./express-config'); // express-config.js now exports the app
const directoryUtils = require('./directory-utils'); // directory-utils.js exports utils
const { initializeSocketIO } = require('./socket-handlers'); // socket-handlers.js exports the initializer

const port = 8080; // Default port

// Function to get local IP address
const getLocalIpAddress = () => {
    const ifaces = os.networkInterfaces();
    for (const dev in ifaces) {
        const iface = ifaces[dev].filter(details => details.family === 'IPv4' && details.internal === false);
        if (iface.length > 0) {
            return iface[0].address;
        }
    }
    return '127.0.0.1'; // Fallback
};

const host = getLocalIpAddress();

// If HTTPS is allowed please add options in the handler function.and use
// https.createServer instead of http.createServer.
// For HTTPS, you would also need to require 'https' and potentially 'fs' for options.
const server = http.createServer(app).listen(process.env.PORT || port, () => {
    const actualPort = server.address().port;
    const localAddress = `${host}:${actualPort}`;
    console.log(`listening on ${localAddress}`);

    // Pass the actual public path and a function to get localAddress to socket handlers
    // This avoids relying on global state for localAddress within socket-handlers
    const publicPath = path.join(__dirname, 'public');
    initializeSocketIO(io, directoryUtils, publicPath, () => localAddress);
});

const io = require('socket.io')(server);

// The initializeSocketIO call was moved inside the listen callback
// to ensure localAddress (which depends on server.address().port) is correctly determined
// before being potentially used by socket-handlers.
// However, localAddress for 'presence server' emit in socket-handlers
// might be needed before a client connects to the HTTP server.
// Let's refine this: localAddress for socket.io purposes should be determined once.

// Determine localAddress for socket.io purposes
// Note: server.address() is null until 'listening' event, so we construct it manually for now
// or pass a getter function if dynamic port (like process.env.PORT) is critical.
// For simplicity, if process.env.PORT is used, the console log will show the right one,
// but initial emits from socket-handlers might use the default 'port' if not careful.

// The current initializeSocketIO takes a getLocalAddress function, which is good.
// server.js is now much leaner.
// The SSL options part is commented out as in the original, can be added if needed.
/*
// Comment out to get HTTPS. Requires SSL certificate.
// var https = require('https'); // Would be needed for HTTPS
// var fs = require('fs'); // Would be needed for SSL options
var options = {
     key: fs.readFileSync('privkey.pem'),
     cert: fs.readFileSync('full-chain.pem'),
     ca: fs.readFileSync('chain.pem')
}
// If HTTPS is allowed please add options in the handler function.and use
// https.createServer(options, app).listen(...) instead of http.createServer.
*/
