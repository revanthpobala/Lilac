const {
    createIdentifierObject,
    findIdentifier,
    addKey,
    checkTimeStamp,
    checkPresence,
    createClientObject,
    addClient,
    addFutureClient,
    checkConnection,
    createConnectionObject,
    addConnection,
    addFutureConnection,
    removeContactPair,
    removeIdPresence,
    incrementUserCount,
} = require('./data-management');

const {
    baseHighto16,
    get_key_pair,
    base16toHigh,
    encrypt_simple,
    decrypt_from_client,
    array_is_full,
    encrypt_for_client, // Added this as it's used by prepare_for_home
} = require('./utils');

// Moved from lp.js, used by prepare_for_home and the main 'x' handler
const base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// prepare_for_home was slightly modified to take currentIdentifier and use its queue
// It no longer returns the data, but directly enqueues it.
const prepare_for_home = (type, content, currentIdentifier) => {
    let return_data = { type, x: content };
    return_data = JSON.stringify(return_data);
    return_data = encrypt_for_client(return_data, currentIdentifier); // currentIdentifier needs key and encrypt_iv
    return_data = { x: return_data };
    currentIdentifier.queue.push({ event: 'x', data: return_data });
    // No return needed as it mutates the queue
};


const initializeSocketIOServer = (io, config) => { // dataManagement and utils are used internally now
                                                    // config can hold nodeServer_address, localAddress getter
    io.sockets.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        socket.on('x', (data) => {
            if (data.hasOwnProperty('x')) {
                let currentIdentifier = findIdentifier(socket.id);

                if (currentIdentifier == null) {
                    // In original lp.js, data.type was checked BEFORE data.x
                    // Assuming data is an object like { type: 'gx presence server', x: { ... } }
                    // This was a bit inconsistent in the original lp.js 'x' handler for new clients.
                    // For a new client, we expect 'gx presence server'
                    // The original code was: if (data.type == 'gx presence server')
                    // And then data = data.x;
                    // This structure implies data is { type: "...", x: "encrypted_payload" } OR
                    // data is { type: "gx presence server", x: { actual_gx_payload } } (where .x is not encrypted yet)

                    // Let's assume the outer 'data' is the wrapper, and data.x is the encrypted part if not gx_presence_server
                    // For gx_presence_server, the original code structure was:
                    // socket.on('x', function(data) { -> data here is the { type: 'gx...', x: {...} } object
                    //   if (data.type == 'gx presence server') { data = data.x; /* now data is the inner object */ } ... })
                    // This means the 'gx presence server' message itself is not under an outer data.x.
                    // This is a key difference from other messages.

                    if (data.type === 'gx presence server' && data.x && data.x.hasOwnProperty('gx1') && data.x.hasOwnProperty('gx2') && data.x.hasOwnProperty('pid')) {
                        const gxData = data.x; // data.x is the actual payload for gx_presence_server
                        const gx1 = baseHighto16(gxData.gx1);
                        const gx2 = baseHighto16(gxData.gx2);
                        
                        const serverek = get_key_pair(); // From utils
                        const serverpky = get_key_pair(); // From utils
                        const gy = serverpky.publicKey;

                        // compute_shared_secret equivalent
                        const csecret1 = bigInt.str2bigInt(lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(serverek.privateKey)), lib.curve25519_from8bitString(h2s(gx1))))), 16, 64);
                        const csecret2 = bigInt.str2bigInt(lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(serverpky.privateKey)), lib.curve25519_from8bitString(h2s(gx2))))), 16, 64);
                        const sfinal = bigInt.bigInt2str(bigInt.mult(csecret1, csecret2), 16);
                        const sessionid = sfinal;

                        const newIdentifier = createIdentifierObject(socket.id, sessionid, gxData.pid);
                        // newIdentifier.message_array = []; // Already done by createIdentifierObject
                        addKey(socket.id, newIdentifier); // From data-management
                        currentIdentifier = newIdentifier; // So it can be used by prepare_for_home or emit

                        const responseData = {
                            gb: base16toHigh(serverek.publicKey),
                            gy: base16toHigh(gy)
                        };
                        // Original was: data = {type: 'gy presence server', x: data}; data = JSON.stringify(data);
                        // data = encrypt_simple(data, gx1); data = {x: data}; socket.emit('x', data);
                        // This encrypt_simple used gx1 as key, which is unusual. Usually sessionid.
                        // For now, follow original pattern of encryption if it was intended for gx1.
                        // However, encrypt_simple is for {mode: "gcm"} without explicit IV.
                        // Let's re-evaluate: The response should be to the *client relay*, not the end user.
                        // The client relay (nc.js) that sent 'gx presence server' expects a response.
                        // That response in nc.js is NOT decrypted with a session key yet.
                        // The encryption for 'gy presence server' response in lp.js used:
                        // data = JSON.stringify({type: 'gy presence server', x: responseData});
                        // data = encrypt_simple(data, gx1); // gx1 was the *public key part* from the client relay
                        // This is asymmetric-like encryption if gx1 is a shared secret derived from DH.
                        // This part is complex. Let's assume encrypt_simple is correct for now.
                        // The client (nc.js) would need to decrypt this with serverek.publicKey if it's a direct symmetric encryption.
                        // The original code: sjcl.encrypt(sID, msg) implies sID is a symmetric key.
                        // gx1 is a public component. This needs careful review of nc.js's expectation for 'gy presence server' response.
                        // For now, replicating the structure:
                        let gyResponse = { type: 'gy presence server', x: responseData };
                        gyResponse = JSON.stringify(gyResponse);
                        gyResponse = encrypt_simple(gyResponse, gx1); // Using gx1 as key as per original
                        socket.emit('x', { x: gyResponse });

                    } else {
                        console.log("Unknown initial message type or malformed gx_presence_server, disconnecting client: ", socket.id, data.type);
                        socket.disconnect(); // Or handle error appropriately
                        return;
                    }
                } else { // currentIdentifier exists
                    let decryptedData;
                    try {
                        decryptedData = decrypt_from_client(data.x, currentIdentifier); // from utils
                    } catch (err) {
                        console.log("Error decrypting client message (likely cover traffic or malformed):", err.message);
                        return; //Error decrypting, most likely because of cover traffic
                    }

                    let parsedData;
                    try {
                        parsedData = JSON.parse(decryptedData);
                    } catch (err) {
                        // Handle split message logic
                        const current_index = base64_chars.indexOf(decryptedData.charAt(0));
                        const message_length = base64_chars.indexOf(decryptedData.charAt(1));
                        let current_message = decryptedData.substring(2);

                        if ((current_index + 1) === message_length) {
                            current_message = current_message.substring(0, current_message.lastIndexOf("}") + 1);
                        }
                        currentIdentifier.message_array[current_index] = current_message;

                        if ((currentIdentifier.message_array).length === message_length && array_is_full(currentIdentifier.message_array)) {
                            const stitchedData = (currentIdentifier.message_array).join("");
                            currentIdentifier.message_array.length = 0; // Reset array
                            try {
                                parsedData = JSON.parse(stitchedData);
                            } catch (parseErr) {
                                console.log("Error parsing stitched client message:", parseErr.message);
                                return;
                            }
                        } else {
                            return; // Wait for more pieces
                        }
                    }

                    const type = parsedData.type;
                    const payload = parsedData.x; // payload is the 'x' attribute of the parsedData
                    if (type !== 'x') console.log(`Handling type: ${type} for socket: ${socket.id}`);

                    switch (type) {
                        case 'register presence':
                            checkTimeStamp(); // From data-management
                            if (checkPresence(payload.username1) == null) {
                                const newClient = createClientObject(payload.username1, socket.id);
                                addClient(newClient);
                                incrementUserCount(); // Manage count via data-management
                                console.log(`${payload.username1} added. ${config.getUserCount()} users.`); // Use getter for count

                                prepare_for_home('presence registered', { result: true }, currentIdentifier);
                                // socket.emit('x', sendData); // prepare_for_home now enqueues

                                if (checkFuturePresence(payload.username2) == null) {
                                    const futureClient = createClientObject(payload.username2, socket.id);
                                    addFutureClient(futureClient);
                                }
                            } else {
                                prepare_for_home('presence registered', { result: false }, currentIdentifier);
                                // socket.emit('x', sendData);
                            }
                            break;
                        case 'request connection':
                            checkTimeStamp();
                            console.log(`Connection request received for ${payload.username}.`);
                            const targetUser = checkPresence(payload.username); // targetUser is a client object
                            if (targetUser) {
                                console.log(`${targetUser.username} found.`);
                                const targetSocket = io.sockets.sockets.get(targetUser.id);
                                const targetIdentifier = findIdentifier(targetUser.id);

                                if (targetSocket && targetIdentifier) {
                                    const responseToTarget = {
                                        username: payload.myusername, // User requesting connection
                                        gb: payload.gb,
                                        gy: payload.gy,
                                        address: payload.address, // Address of requesting user's exit node
                                        Xpid: currentIdentifier.pid // PID of the current socket's user (original requester)
                                    };
                                    // This response needs to be prepared for the *targetUser*
                                    prepare_for_home('connection requested', responseToTarget, targetIdentifier);
                                    // The original code used tempClient.emit('x', sendData) directly.
                                    // If prepare_for_home enqueues, the heartbeat will send it.
                                } else {
                                     console.log(`Target user ${targetUser.username} or their identifier not fully found for connection request.`);
                                }
                            } else {
                                console.log(`Target user ${payload.username} not found for connection request.`);
                                // Optionally, send a "user not found" back to requester
                            }
                            break;
                        case 'request private connection':
                            checkTimeStamp();
                            removeContactPair(socket.id); // From data-management
                            const existingConnection = checkConnection(payload.username1); // username1 is connection_id

                            if (existingConnection == null) {
                                const newConn = createConnectionObject(payload.username1, socket.id);
                                addConnection(newConn);

                                if (checkFutureConnection(payload.username2) == null) {
                                    const futureConn = createConnectionObject(payload.username2, socket.id);
                                    addFutureConnection(futureConn);
                                }
                            } else {
                                if (socket.id !== existingConnection.id) {
                                    console.log(`${existingConnection.connection_id} found for private connection.`);
                                    const targetSocket = io.sockets.sockets.get(existingConnection.id);
                                    const targetIdentifier = findIdentifier(existingConnection.id);

                                    if (targetSocket && targetIdentifier) {
                                        const responseToTarget = {
                                            username: payload.username1, // The connection_id itself
                                            gb: payload.gb,
                                            gy: payload.gy,
                                            address: payload.address,
                                            Xpid: currentIdentifier.pid
                                        };
                                        prepare_for_home('connection requested', responseToTarget, targetIdentifier);
                                        removeContactPair(existingConnection.id); // Remove the matched one
                                    } else {
                                        console.log(`Target for private connection ${existingConnection.connection_id} or their identifier not fully found.`);
                                    }
                                }
                            }
                            break;
                        default:
                            console.log(`Unknown message type: ${type} from socket: ${socket.id}`);
                            break;
                    }
                }
            } else {
                console.log(`Message without 'x' property from ${socket.id}:`, data);
            }
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            removeIdPresence(socket.id); // From data-management
        });

        socket.on('error', (err) => {
            console.error(`Socket error for ${socket.id}:`, err);
        });
    });
};

module.exports = { initializeSocketIOServer };
