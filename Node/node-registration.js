const fs = require('fs');
const os = require('os'); // For fallback IP discovery

// This module will need ioClient (from socket.io-client) passed to it,
// as well as nodeServer_address, and functions to get dynamic data and update state.

const initializeNodeRegistration = (
    ioClientInstance,
    nodeServerAddress,
    getGbValue, // Function to get serverek.publicKey
    getDynamicPort, // Function to get server.address().port
    updatePresenceServerAddressFunc, // Callback to update presence_server_address in the main module
    currentHost // Pass the host determined by fs.readFile or os.networkInterfaces()
) => {
    let nodeServer; // This will be the socket client instance for the directory server

    // This function is called after host is determined
    const connectAndRegister = (host) => {
        console.log(`Node's public host determined as: ${host}`);
        const port = getDynamicPort();
        if (!port) {
            console.error("Node registration: Dynamic port is not available yet. Registration might fail or use wrong port.");
            // Decide if to proceed or wait/retry. For now, will proceed.
        }
        const localNodeAddress = `http://${host}:${port}`; // Construct node's own address for registration
        console.log(`Node's local address for registration: ${localNodeAddress}`);

        nodeServer = ioClientInstance(nodeServerAddress, {
            'forceNew': true, // Use forceNew for new connection
            // Consider adding reconnection options if not default in this client version
            // e.g., reconnectionAttempts: Infinity, reconnectionDelay: 1000
        });

        nodeServer.on('connect', () => {
            console.log(`Successfully connected to Node Directory Server: ${nodeServerAddress}`);
            register_node(host, getDynamicPort(), getGbValue()); // Register immediately on connect
            // Set up periodic registration
            // Consider clearing this interval if nodeServer disconnects and needs re-setup.
            setInterval(() => register_node(host, getDynamicPort(), getGbValue()), 60000);
        });

        nodeServer.on('presence server', (data) => {
            if (data && data.presence_server_address) {
                console.log(`Received Presence Server address: ${data.presence_server_address}`);
                updatePresenceServerAddressFunc(data.presence_server_address);
            } else {
                console.warn("Received presence server data, but address is missing:", data);
            }
        });

        nodeServer.on('disconnect', (reason) => {
            console.log(`Disconnected from Node Directory Server: ${reason}. Will attempt to reconnect.`);
            // Socket.IO client might handle reconnection automatically depending on version and options.
            // If not, explicit reconnection logic might be needed here.
        });

        nodeServer.on('connect_error', (error) => {
            console.error(`Error connecting to Node Directory Server at ${nodeServerAddress}: ${error.message}`);
            // Implement retry logic or backoff if necessary
        });
    };


    const register_node = (host, port, gb) => {
        if (!nodeServer || !nodeServer.connected) {
            console.warn("Cannot register node: Not connected to Node Directory Server.");
            return;
        }
        if (!host || !port || !gb) {
            console.error("Cannot register node: host, port, or public key (gb) is missing.", {host, port, gb_defined: !!gb});
            return;
        }
        const nodeData = { host: host, port: port, pk: gb };
        nodeServer.emit('register_node', nodeData);
        // console.log("Sent node registration:", nodeData);
    };

    // Initial connection logic using the passed currentHost
    if (currentHost) {
        connectAndRegister(currentHost);
    } else {
        // Fallback to reading public-ipv4 if currentHost wasn't provided (e.g. initial setup)
        // This part might be redundant if host is always determined before calling initializeNodeRegistration
        fs.readFile('public-ipv4', 'utf8', (err, data) => {
            let resolvedHost;
            if (err) {
                console.warn("Failed to read public-ipv4 for node registration, attempting OS-based IP discovery:", err.message);
                const ifaces = os.networkInterfaces();
                for (const dev in ifaces) {
                    const iface = ifaces[dev].filter(details => details.family === 'IPv4' && details.internal === false);
                    if (iface.length > 0) {
                        resolvedHost = iface[0].address;
                        break;
                    }
                }
                if (!resolvedHost) {
                    console.error("Node registration: Could not determine host IP address from OS network interfaces.");
                    resolvedHost = '127.0.0.1'; // Last resort
                }
            } else {
                resolvedHost = data.trim();
            }
            connectAndRegister(resolvedHost);
        });
    }
    // Return the nodeServer instance if it needs to be accessed externally (e.g. for manual disconnect)
    // However, it's better to manage its lifecycle internally if possible.
    // For now, not returning it, assuming this module handles its connection lifecycle.
};

module.exports = {
    initializeNodeRegistration,
};
