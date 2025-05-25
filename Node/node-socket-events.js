// node-socket-events.js

const initializeSocketEvents = (io, clientManager, utils, config, serverState) => {
    // Destructure needed functions/objects from modules for easier use
    const { ClientPrototype, find_client, add_client, delete_client, find_client_by_pid } = clientManager;
    const {
        decrypt_fix_IV,
        baseHighto16,
        get_key_pair,
        compute_shared_secret,
        base16toHigh,
        encrypt_fix_IV,
        remove_padding,
        decrypt_from_client,
        array_is_full,
        add_padding,
        prepare_for_home, // Assuming prepare_for_home is moved to utils or passed in serverState
                           // For now, it's not in utils.js from previous steps.
                           // Let's define it locally for now if it's only used here.
    } = utils;

    // Local prepare_for_home if not in utils (original was in nc.js global scope)
    // This function encrypts and formats messages for the client.
    const local_prepare_for_home = (type, content, client) => {
        // 'client' here is the client object (from clientManager.ClientPrototype)
        // It needs sID and encrypt_iv properties.
        let return_data = {type: type, x: content};
        return_data = JSON.stringify(return_data);
        return_data = utils.encrypt_for_client(return_data, client); 
        return_data = {x: return_data};
        // In original nc.js, this was then usually put into a queue
        return return_data;
    };


    io.sockets.on('connection', (socket) => {
        // console.log(`Socket ${socket.id} connected.`);

        socket.on('x', (data) => {
            if (data.hasOwnProperty('x')) {
                let myClient = find_client(socket.id);

                if (myClient == null) {
                    if (data.hasOwnProperty('x')) { // This check is redundant due to outer if
                        try {
                            let decrypted_data = decrypt_fix_IV(data.x, serverState.serverek.publicKey);
                            decrypted_data = decrypted_data.substring(2, decrypted_data.lastIndexOf("}") + 1);
                            const parsed_data = JSON.parse(decrypted_data);

                            if (parsed_data.type !== 'gx') {
                                // console.log("Initial message not gx type, ignoring.", parsed_data.type);
                                return;
                            }
                            const gx_payload = parsed_data.x;

                            if (gx_payload.hasOwnProperty('gx1') && gx_payload.hasOwnProperty('gx2')) {
                                // serverState.gx1 = baseHighto16(gx_payload.gx1); // gx1, gx2 are now part of serverState
                                // serverState.gx2 = baseHighto16(gx_payload.gx2);
                                // Use local gx1, gx2 for this specific key exchange
                                const local_gx1 = baseHighto16(gx_payload.gx1);
                                const local_gx2 = baseHighto16(gx_payload.gx2);
                                
                                const serverpky = get_key_pair(); // Our ephemeral key for this specific exchange
                                const gy = serverpky.publicKey;
                                // Pass local_gx1, local_gx2 to compute_shared_secret
                                const sessionid = compute_shared_secret(serverState.serverek, serverpky, local_gx1, local_gx2);

                                myClient = new ClientPrototype(); // Create new client instance
                                myClient.id = socket.id;
                                myClient.sID = sessionid;
                                myClient.client = gx_payload.hasOwnProperty('client') ? gx_payload.client : false;

                                if (!myClient.client && gx_payload.hasOwnProperty('f1') && gx_payload.hasOwnProperty('f2')) {
                                    const f1 = baseHighto16(gx_payload.f1);
                                    const f2 = baseHighto16(gx_payload.f2);
                                    myClient.node_key = compute_shared_secret(serverState.serverek, serverpky, f1, f2);
                                }
                                add_client(myClient);

                                let response_data = { gy: base16toHigh(gy) };
                                response_data = { type: 'gy', x: response_data };
                                response_data = JSON.stringify(response_data);
                                response_data = encrypt_fix_IV(response_data, serverState.serverek.publicKey); // Encrypt with server's main public key? Original used this.
                                response_data = { x: response_data };
                                myClient.queue.enqueue({ event: 'x', data: response_data });
                            }
                        } catch (err) {
                            // console.log("Error processing initial 'x' message (potential heartbeat or malformed gx):", err.message);
                            return;
                        }
                    }
                } else { // myClient exists
                    if (myClient.bridge && myClient.pid) {
                        const bridgeAuthClient = find_client(myClient.pid); // Authenticate via original client
                        if (bridgeAuthClient && bridgeAuthClient.next && bridgeAuthClient.next.id === socket.id) { // Check if this socket is indeed the 'next' of the original client
                            try {
                                data = remove_padding(data, myClient); // myClient here is the forward client for the bridge
                            } catch (e) {
                                // console.log("Bridge: Error removing padding (cover traffic?):", e.message);
                                return; 
                            }
                            data.x = utils.encrypt_for_client(data.x, bridgeAuthClient); // Encrypt for the original client
                            data = add_padding(data, bridgeAuthClient); // Add padding for original client's perspective
                            bridgeAuthClient.queue.enqueue({ event: 'x', data: data });
                        } else {
                            // console.log("Bridge authentication failed or 'next' socket mismatch.");
                        }
                        return;
                    }

                    let decrypted_payload_str;
                    try {
                        data = remove_padding(data, myClient);
                        decrypted_payload_str = decrypt_from_client(data.x, myClient);
                    } catch (err) {
                        // console.log("Error decrypting/removing padding (cover traffic?):", err.message);
                        return;
                    }

                    let parsed_payload;
                    try {
                        parsed_payload = JSON.parse(decrypted_payload_str);
                    } catch (err) {
                        const current_index = utils.base64_chars.indexOf(decrypted_payload_str.charAt(0));
                        const message_length = utils.base64_chars.indexOf(decrypted_payload_str.charAt(1));
                        let current_message = decrypted_payload_str.substring(2);

                        if ((current_index + 1) === message_length) {
                            current_message = current_message.substring(0, current_message.lastIndexOf("}") + 1);
                        }
                        myClient.message_array[current_index] = current_message;

                        if (myClient.message_array.length === message_length && array_is_full(myClient.message_array)) {
                            const stitched_data = myClient.message_array.join("");
                            myClient.message_array.length = 0;
                            try {
                                parsed_payload = JSON.parse(stitched_data);
                            } catch (parseErr) {
                                // console.log("Error parsing stitched message:", parseErr.message);
                                return;
                            }
                        } else {
                            return; // Wait for more pieces
                        }
                    }

                    const type = parsed_payload.type;
                    const payload_content = parsed_payload.x;

                    switch (type) {
                        case 'x':
                            if (myClient.next) {
                                let forward_data = { x: payload_content };
                                if (!myClient.server) { // Not a presence server connection
                                    forward_data = add_padding(forward_data, myClient.next);
                                }
                                myClient.next.queue.enqueue({ event: 'x', data: forward_data });
                            }
                            break;
                        case 'next-node':
                            if (payload_content.hasOwnProperty('address') && payload_content.hasOwnProperty('key')) {
                                // new_forward is passed via serverState
                                myClient.next = serverState.new_forward(payload_content.address, socket.id, 'norm');
                                myClient.next.node_key = baseHighto16(payload_content.key);
                                
                                let response_data = { type: 'next-node-connected', x: { o: 'o' } };
                                response_data = local_prepare_for_home('next-node-connected', {o:'o'}, myClient); // Use local_prepare_for_home
                                // response_data now contains {x: encrypted_string}
                                response_data = add_padding(response_data, myClient); // Add outer padding if needed (original did not for this specific response)
                                myClient.queue.enqueue({ event: 'x', data: response_data });
                            }
                            break;
                        case 'gx': // Establishing/Re-establishing key with next node
                            if (myClient.next) {
                                let gx_forward_data;
                                if (myClient.next.node_key_established) {
                                    gx_forward_data = { x: payload_content }; // Pass through if key already set
                                    gx_forward_data = add_padding(gx_forward_data, myClient.next);
                                } else {
                                    // serverState will hold fx1, fx2 if they are server-wide for this type of gx
                                    // Or, generate them here if they are per-connection attempt
                                    serverState.fx1 = get_key_pair(); // Store in serverState if needed by other parts (e.g. bridge logic)
                                    serverState.fx2 = get_key_pair();
                                    
                                    let gx_payload_to_encrypt = { ...payload_content }; // Clone
                                    gx_payload_to_encrypt.f1 = base16toHigh(serverState.fx1.publicKey);
                                    gx_payload_to_encrypt.f2 = base16toHigh(serverState.fx2.publicKey);
                                    
                                    gx_payload_to_encrypt = { type: "gx", x: gx_payload_to_encrypt };
                                    // Original: data = "01" + JSON.stringify(data); -> this suggests message splitting format
                                    // This specific prefixing needs to be handled by encryption/packaging if it's a general pattern
                                    // For now, assuming encrypt_fix_IV handles the full payload.
                                    // The "01" might be an index/length for split messages, handled by general parsing.
                                    // If it's specific to gx, then:
                                    let stringified_gx_payload = JSON.stringify(gx_payload_to_encrypt);
                                    // Check if message splitting is needed based on length or always for 'gx'
                                    // Original: data = "01" + JSON.stringify(data); This implies it's piece 0 of 1 piece.
                                    // Let's assume for now that encrypt_fix_IV encrypts the entire stringified_gx_payload.
                                    // The splitting logic is usually applied *before* this switch statement.
                                    // This means this 'gx' type is likely the *content* of a message, not the raw data.
                                    
                                    const encrypted_gx = encrypt_fix_IV(stringified_gx_payload, myClient.next.node_key);
                                    gx_forward_data = { x: encrypted_gx };
                                    // No add_padding here in original for gx setup message to next node
                                }
                                myClient.next.queue.enqueue({ event: 'x', data: gx_forward_data });
                                myClient.next.initiator = true;
                            }
                            break;
                        case 'gx presence server':
                            if (payload_content.hasOwnProperty('gx1') && payload_content.hasOwnProperty('gx2')) {
                                if (!(myClient.next)) { // Only if not already connected to a presence server
                                    // serverState.presence_server_address is a getter
                                    myClient.next = serverState.new_forward(serverState.presence_server_address, socket.id, 'server');
                                    myClient.server = true; // Mark this client as connected to a presence server
                                    
                                    let ps_payload = { ...payload_content }; // Clone
                                    ps_payload.pid = socket.id; // Add current socket.id as pid for presence server context
                                    ps_payload = { type: 'gx presence server', x: ps_payload };
                                    // This message is sent as is, without additional encryption wrapper here,
                                    // as new_forward sets up a new connection context.
                                    myClient.next.queue.enqueue({ event: 'x', data: ps_payload });
                                }
                            }
                            break;
                        case 'start chat':
                            if (payload_content.hasOwnProperty('username') && payload_content.hasOwnProperty('gb') &&
                                payload_content.hasOwnProperty('gy') && payload_content.hasOwnProperty('address') &&
                                payload_content.hasOwnProperty('pid')) {
                                if (myClient.next && myClient.server) { // Must be connected to a presence server
                                    // add_bridge_forward is passed via serverState
                                    serverState.add_bridge_forward(myClient, payload_content.address, socket.id);
                                    
                                    let bridge_payload = { ...payload_content }; // Clone
                                    bridge_payload.Xpid = socket.id;
                                    // serverState.localAddress is a getter
                                    bridge_payload.address = serverState.localAddress;
                                    
                                    // serverState.fx1, serverState.fx2 should be new for this bridge attempt
                                    serverState.fx1 = get_key_pair();
                                    serverState.fx2 = get_key_pair();
                                    bridge_payload.f1 = base16toHigh(serverState.fx1.publicKey);
                                    bridge_payload.f2 = base16toHigh(serverState.fx2.publicKey);
                                    
                                    // myClient.next is now the bridge connection
                                    myClient.next.queue.enqueue({ event: 'connection accepted', data: bridge_payload });
                                    myClient.next.initiator = true;
                                }
                            }
                            break;
                        case 'end conversation':
                            if (myClient.bridge) {
                                const parallelClient = find_client_by_pid(socket.id);
                                if (parallelClient) delete_client(parallelClient.id);
                                
                                myClient.bridge = false;
                                delete myClient.initiator; // Remove initiator flag
                                if (myClient.next) myClient.next.disconnect(); // Disconnect from bridge partner
                                myClient.next = myClient.serverClient; // Revert to presence server connection
                                myClient.serverClient = null;
                                myClient.server = true; // Back to being a presence server client
                            }
                            break;
                        default:
                            // console.log("Unknown message type in 'x' handler:", type);
                            break;
                    }
                }
            } else {
                // console.log("Message without 'x' property received from socket:", socket.id, data);
            }
        });

        socket.on("connection accepted", (data) => {
            let myClient = null;
            if (data.hasOwnProperty('pid') && data.hasOwnProperty('Xpid') && data.hasOwnProperty('address') &&
                data.hasOwnProperty('f1') && data.hasOwnProperty('f2')) {
                myClient = find_client(data.pid); // pid is the original client on this server who initiated
            }

            if (myClient == null || !myClient.server) { // Must be an existing client connected to a presence server
                // console.log("Invalid 'connection accepted' received or client not in correct state.");
                return;
            }

            // serverState.add_bridge_forward is used
            serverState.add_bridge_forward(myClient, data.address, socket.id); // socket.id is the new bridge connection
            
            // serverState.fx1, serverState.fx2 should be new for this key exchange
            serverState.fx1 = get_key_pair();
            serverState.fx2 = get_key_pair();
            const f1_remote = baseHighto16(data.f1);
            const f2_remote = baseHighto16(data.f2);
            myClient.next.node_key = compute_shared_secret(serverState.fx1, serverState.fx2, f1_remote, f2_remote);
            myClient.next.encrypt_node_iv = "////////////"; // Reset IVs for new link
            myClient.next.decrypt_node_iv = "AAAAAAAAAAAA";

            const bridgeData = {
                pid: data.Xpid, // PID of the client on the *other* server
                f1: base16toHigh(serverState.fx1.publicKey),
                f2: base16toHigh(serverState.fx2.publicKey)
            };
            myClient.next.queue.enqueue({ event: 'connect bridge', data: bridgeData });

            // Create a client object for this new bridge socket connection
            const bridgeSocketClient = new ClientPrototype();
            bridgeSocketClient.id = socket.id; // The new socket that accepted the connection
            bridgeSocketClient.bridge = true;
            bridgeSocketClient.pid = myClient.id; // Link back to the original client that initiated
            add_client(bridgeSocketClient);

            // Notify original client
            let notifyData = { ...data }; // Clone
            delete notifyData.pid; delete notifyData.Xpid; delete notifyData.address;
            delete notifyData.f1; delete notifyData.f2;
            
            const preparedNotification = local_prepare_for_home('connection accepted', notifyData, myClient);
            const paddedNotification = add_padding(preparedNotification, myClient); // Original did add_padding here
            myClient.queue.enqueue({ event: 'x', data: paddedNotification });
        });

        socket.on("connect bridge", (data) => {
            let myClient = null; // This is the client on the 'initiator' side of the bridge
            if (data.hasOwnProperty('pid')) { // pid is the original client on *this* server
                myClient = find_client(data.pid);
            }

            if (myClient == null || !myClient.bridge || !myClient.next) { // Must be a bridge client with a 'next' connection
                // console.log("Invalid 'connect bridge' received or client not in correct state.");
                return;
            }
            
            // serverState.fx1, serverState.fx2 are from when this side initiated 'connection accepted'
            const f1_remote = baseHighto16(data.f1);
            const f2_remote = baseHighto16(data.f2);
            myClient.next.node_key = compute_shared_secret(serverState.fx1, serverState.fx2, f1_remote, f2_remote);
            // IVs for myClient.next were already set when new_forward was called by add_bridge_forward

            // Create a client object for this new bridge socket connection
            const bridgeSocketClient = new ClientPrototype();
            bridgeSocketClient.id = socket.id; // The new socket that connected for the bridge
            bridgeSocketClient.bridge = true;
            bridgeSocketClient.pid = myClient.id; // Link back to the original client
            add_client(bridgeSocketClient);
            // console.log("Bridge connected two-ways for original client:", myClient.id);
        });

        socket.on('disconnect', () => {
            // console.log(`Socket ${socket.id} disconnected.`);
            const myClient = find_client(socket.id);
            if (myClient) {
                if (myClient.bridge) { // Disconnection on a bridge link
                    if (myClient.next) { // If this side of the bridge had a 'next' (it shouldn't, bridge clients are direct)
                        // This case implies an issue or that 'myClient.next' was the other bridge peer.
                        // Original logic: circuit broken if myClient.next exists
                        // console.log("Bridge client with a 'next' disconnected - complex case.");
                        const parallelClient = find_client_by_pid(socket.id); // socket.id is myClient.id
                        if (parallelClient) delete_client(parallelClient.id); // Should be deleting based on myClient.pid
                        
                        myClient.next.disconnect(); // Disconnect the other side if this was an active link
                        if (myClient.serverClient) myClient.serverClient.disconnect(); // Disconnect from presence server too
                        delete_client(myClient.id);

                    } else { // More common: a bridge client (representing remote peer) disconnected
                        // console.log("Remote bridge peer disconnected.");
                        const circuitClient = find_client(myClient.pid); // Get the original client using this bridge
                        delete_client(myClient.id); // Delete this bridge peer client object

                        if (circuitClient) {
                            if (circuitClient.next && circuitClient.next.id === socket.id) { // If this was the active bridge link for circuitClient
                                // circuitClient.next.disconnect(); // Already disconnected
                                circuitClient.next = circuitClient.serverClient; // Revert to presence server
                                circuitClient.server = true;
                                circuitClient.bridge = false;
                                circuitClient.serverClient = null;
                                delete circuitClient.initiator;

                                const notification = local_prepare_for_home('conversation ended', {o:'o'}, circuitClient);
                                const paddedNotification = add_padding(notification, circuitClient);
                                circuitClient.queue.enqueue({ event: 'x', data: paddedNotification });
                            }
                        }
                    }
                } else if (myClient.next) { // Normal client with a forward connection
                    // console.log("Client with forward connection disconnected.");
                    myClient.next.disconnect(); // Disconnect next hop
                    delete_client(myClient.id);
                } else { // Client without a forward connection (e.g., direct client or end of chain)
                    // console.log("Client without forward connection disconnected.");
                    delete_client(myClient.id);
                }
            }
        });

        socket.on('error', (err) => {
            console.error(`Socket error for ${socket.id}:`, err.stack);
            // Consider cleaning up the client if a socket error occurs
            delete_client(socket.id);
        });
    });
};

module.exports = {
    initializeSocketEvents,
};
