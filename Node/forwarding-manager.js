// Node/forwarding-manager.js
const ioClient = require('socket.io-client');
const Queue = require('./Queue'); // Used by new_forward for the client's queue

// serverState will provide fx1, fx2, and potentially serverek if needed for compute_shared_secret
// getIOInstance is for accessing io.sockets.sockets.get() if needed (though not directly by new_forward itself)
const initializeForwarding = (clientManager, utils, config, serverState, getIOInstance) => {
    
    // Moved from nc.js
    // These are defined inside initializeForwarding to capture the provided modules in their closure.
    
    function new_forward(address, original_client_id, type, exchangeKeys = null) {
        // original_client_id is the ID of the client on *this* server that is extending the circuit.
        // exchangeKeys: { fx1, fx2 } if this node is initiating the key exchange for the new link
        
        const forwardClientSocket = ioClient(address, { 'forceNew': true });
        
        // Create a minimal representation for this outgoing connection.
        // This is not a full ClientPrototype from clientManager, as it's an *outgoing* socket.
        // It needs properties for managing its own state with the next hop.
        const forwardLink = {
            id: forwardClientSocket.id, // The socket.id of this outgoing connection
            socket: forwardClientSocket, // The actual socket.io client instance
            pid: original_client_id,    // Links back to the client on our server
            queue: new Queue.Queue(),
            node_key: null,
            node_key_established: false,
            encrypt_node_iv: "AAAAAAAAAAAA", // IVs for *this* link
            decrypt_node_iv: "////////////",
            // 'initiator' can be set if this side initiated key exchange,
            // useful for IV direction if using the main encrypt/decrypt_from_node utils.
            // If exchangeKeys is provided, this side is the initiator for this specific link's key.
            initiator: !!exchangeKeys 
        };

        forwardClientSocket.on("x", function(data) { // 'this' is forwardClientSocket
            const originalClient = clientManager.find_client(forwardLink.pid);
            if (originalClient) {
                if (forwardLink.node_key_established) {
                    try {
                        // Use forwardLink for decryption context from next node
                        data = utils.remove_padding(data, forwardLink); 
                    } catch (e) { /* console.log("FWD 'x': remove_padding error", e.message); */ return; }
                } else {
                    // Key not yet established, expecting 'gy' for key exchange
                    try {
                        // The key used here (forwardLink.node_key) is the one-time key for this hop,
                        // derived from 'key' in 'next-node' message or similar.
                        data = utils.decrypt_fix_IV(data.x, forwardLink.node_key); 
                        data = JSON.parse(data);
                        if (data.type === 'gy') {
                            const gy_remote = utils.baseHighto16(data.x.gy);
                            // exchangeKeys (fx1, fx2) were used to create the initial 'gx' sent to this next hop.
                            // These must be the fx1, fx2 corresponding to the 'gx' this 'gy' is a response to.
                            if (!exchangeKeys || !exchangeKeys.fx1 || !exchangeKeys.fx2) {
                                // console.error("FWD 'x': Missing fx1/fx2 for 'gy' processing.");
                                return;
                            }
                            forwardLink.node_key = utils.compute_shared_secret(
                                exchangeKeys.fx1, 
                                exchangeKeys.fx2, 
                                forwardLink.node_key, // This was the public key of the next hop
                                gy_remote             // This is the public key from the next hop's response
                            );
                            forwardLink.node_key_established = true;
                            data = { type: 'gy', x: data.x }; 
                            data = { x: JSON.stringify(data) }; 
                        } else {
                            // console.log("FWD 'x': Key not established and message not 'gy'. Type:", data.type);
                            return;
                        }
                    } catch (e) { /* console.log("FWD 'x': gy processing error", e.message); */ return; }
                }
                // Message is now decrypted (or was a gy response), encrypt for original client
                data.x = utils.encrypt_for_client(data.x, originalClient);
                data = utils.add_padding(data, originalClient); // Pad for original client
                originalClient.queue.enqueue({ event: 'x', data: data });
            } else {
                // console.log("FWD 'x': Original client not found for pid", forwardLink.pid);
            }
        });

        forwardClientSocket.on('disconnect', function() {
            const originalClient = clientManager.find_client(forwardLink.pid);
            if (originalClient) {
                // If the disconnected socket was the 'next' hop for originalClient
                if (originalClient.next && originalClient.next.id === forwardLink.id) { 
                    if (originalClient.bridge || originalClient.server) {
                        const backwardSocket = getIOInstance().sockets.sockets.get(originalClient.id);
                        if (backwardSocket) {
                            backwardSocket.disconnect(); // Disconnect the client on our server side
                        }
                        clientManager.delete_client(originalClient.id); // Clean up original client
                    } else {
                        originalClient.next = null; // Simply clear the forward link
                        // Potentially notify originalClient that forward link is down
                    }
                }
            }
            // console.log("Forward connection disconnected:", forwardClientSocket.id);
        });
        
        // Apply type-specific listener modifications
        switch (type) {
            case 'server': // Connection to a presence server
                forwardClientSocket.removeAllListeners('x');
                forwardClientSocket.on("x", function(data) {
                    const originalClient = clientManager.find_client(forwardLink.pid);
                    if (originalClient && originalClient.server) {
                        // Data from presence server is for originalClient
                        data.x = utils.encrypt_for_client(data.x, originalClient);
                        data = utils.add_padding(data, originalClient);
                        originalClient.queue.enqueue({ event: 'x', data: data });
                    }
                });
                break;
            case 'bridge': // Connection to another relay for a bridge
                // Bridge connections have very specific message flow, often handled by
                // 'connection accepted' and 'connect bridge' rather than generic 'x'.
                // Original code removed 'x' and 'disconnect' for bridges here.
                forwardClientSocket.removeAllListeners('x');
                forwardClientSocket.removeAllListeners('disconnect'); 
                // Specific bridge event handlers will be on the *sockets* of the bridge connection,
                // not on this forwardLink's socket events directly after setup.
                break;
            case 'norm': // Normal hop in a circuit
                // The default 'x' and 'disconnect' handlers are generally fine.
                break;
        }
        
        // Return the minimal forwardLink object, which includes the socket.
        // The calling context (e.g. in node-socket-events) will attach this to originalClient.next
        return forwardLink; 
    }

    function add_bridge_forward(myClient, data_address, keysForNewLink) {
        // myClient is the original client on this server (e.g. from clientManager.find_client())
        // data_address is the address of the other relay node for the bridge
        // keysForNewLink: { fx1, fx2 } generated by the caller (node-socket-events) for this bridge attempt
        
        const bridgeForwardLink = new_forward(data_address, myClient.id, 'bridge', keysForNewLink);
        
        myClient.serverClient = myClient.next; // Store old connection (e.g. to presence server)
        myClient.next = bridgeForwardLink; // 'next' is now the bridge link object
        myClient.bridge = true;
        myClient.server = false;
        // 'initiator' might be set on myClient or myClient.next depending on who started bridge
    }

    return {
        new_forward,
        add_bridge_forward,
        // add_server_listeners and add_bridge_listeners are now internal helpers to new_forward
    };
};

module.exports = { initializeForwarding };
