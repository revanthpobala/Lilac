const Chance = require('chance'); // For getSpam

// Moved from lp.js, used by getSpam
const base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const getSpam = (chanceInstance) => { // Pass chanceInstance to avoid global
    // Original getSpam in lp.js used chance.string({length: 140, pool: '0123456789abcdef'});
    // and then encrypt_simple(data, key);
    // This seems too complex for just "spam" if it's meant to be cover traffic.
    // The nc.js getSpam is simpler: chance.string({length: 682, pool: base64_chars}) + "==," + chance.string({length: 22, pool: base64_chars}) + "==";
    // For now, I'll replicate the lp.js getSpam's *structure* of returning an object for emit.
    // The actual content might need review for its purpose (cover traffic vs. actual test data).
    // For simplicity and to avoid dependency on encrypt_simple here, I'll make it a simple string.
    // If encryption is truly needed for spam, utils.encrypt_simple would be imported.
    const spamData = chanceInstance.string({ length: 140, pool: base64_chars });
    return { event: "q", data: { x: spamData } }; // Matching the expected structure for emit
};

// ioInstance is the main Socket.IO server instance (io)
// keyTree is the RBTree instance from data-management.js
// utils.encrypt_simple would be needed if getSpam was more complex
const startHeartbeat = (ioInstance, keyTree, chanceInstance, interval = 5000) => {
    const heartbeatFn = () => {
        const treeVisitor = (socket_id, identifier) => { // key is socket_id, val is identifier object
            if (!identifier || !identifier.queue) {
                // console.warn(`Heartbeat: Identifier or queue missing for socket_id ${socket_id}`);
                return;
            }

            const msg = (identifier.queue.length > 0) ? identifier.queue.shift() : getSpam(chanceInstance);
            const skt = ioInstance.sockets.sockets.get(socket_id);

            if (skt) {
                if (msg && msg.event && msg.data) { // Ensure msg structure is correct
                    skt.emit(msg.event, msg.data);
                } else {
                    // console.warn(`Heartbeat: Invalid message structure for socket_id ${socket_id}`, msg);
                }
            } else {
                // console.warn(`Heartbeat: Socket not found for id ${socket_id}. Might have disconnected.`);
                // Consider cleanup here if socket is gone but identifier remains, though disconnect handler should cover it.
            }
        };

        if (keyTree && typeof keyTree.inorder === 'function') {
            keyTree.inorder(treeVisitor, false); // Assuming 'inorder' iterates (key, value)
        } else {
            console.error("Heartbeat: keyTree is invalid or does not have an inorder method.");
        }
    };

    setInterval(heartbeatFn, interval);
    console.log(`Heartbeat started with interval ${interval}ms.`);
};

module.exports = { startHeartbeat, getSpam }; // Export getSpam if it's used externally, though likely internal to heartbeat
                                          // For now, keeping it as if it could be. Heartbeat needs it.
