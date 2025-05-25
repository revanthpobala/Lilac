const RBTree = require('./rbtree');
const Queue = require('./Queue'); // clientPrototype uses Queue

// RBTree comparison function
const cmp = (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    if (a === b) return 0;
    return 0; // Should not happen with well-defined keys
};

// Initialize RBTree instances scoped to this module
const clientTree = new RBTree(cmp);
const pidTree = new RBTree(cmp);

// Client Prototype function (or class)
// Using a function to match original style, can be converted to class if preferred
function ClientPrototype() {
    this.id = null;
    this.next = null; // Connection to the next relay in the circuit
    this.sID = null;  // Session ID with the current client/previous relay
    this.client = false; // Is this an end-user client connection?
    this.server = false; // Is this connection to a presence server?
    this.bridge = false; // Is this a bridge connection to another exit node?
    this.decrypt_iv = "AAAAAAAAAAAA";
    this.encrypt_iv = "////////////";
    this.queue = new Queue.Queue(); // Queue for messages to be sent backwards to the user/previous relay
    this.message_array = []; // For reassembling split messages
    this.node_key = null; // Symmetric key with the next relay in the circuit
    this.encrypt_node_iv = "////////////"; // IV for encrypting to next relay
    this.decrypt_node_iv = "AAAAAAAAAAAA"; // IV for decrypting from next relay
    // 'initiator' property for IV management might be added dynamically
}

// Client management functions
const find_client = (id) => {
    return clientTree.get(id);
};

const find_client_by_pid = (pid) => {
    const socket_id = pidTree.get(pid);
    if (socket_id) {
        return clientTree.get(socket_id);
    }
    return null;
};

const add_client = (newClient) => { // newClient should be an instance of ClientPrototype
    if (!newClient || !newClient.id) {
        console.error("ClientManager: Attempted to add invalid client object.", newClient);
        return;
    }
    clientTree.put(newClient.id, newClient);
    if (newClient.pid) { // If it's a bridge client with a PID
        pidTree.put(newClient.pid, newClient.id);
    }
};

const delete_client = (id) => {
    const client = clientTree.get(id);
    if (client) {
        if (client.pid) {
            pidTree.delete(client.pid);
        }
        clientTree.delete(id);
    }
};

module.exports = {
    ClientPrototype, // Export the prototype itself
    cmp, // Export if needed elsewhere, though primarily for internal trees
    find_client,
    find_client_by_pid,
    add_client,
    delete_client,
    // The trees themselves (clientTree, pidTree) are not exported to enforce encapsulation.
    // Operations on them should go through the exported functions.
    forEachClient: (callback) => { // callback should be (value, key) => void
        if (clientTree && typeof clientTree.inorder === 'function') {
            // RBTree.inorder typically provides (key, value)
            // The original temporary solution in nc.js used (key, val) => callback(val, key)
            // So, we adapt here to match the callback expectation of (value, key)
            clientTree.inorder((key, value) => callback(value, key), false);
        } else if (clientTree && typeof clientTree.forEach === 'function') { // For simpler tree structures if RBTree API changes
             // A standard forEach is usually (value, key, map) - adapt if needed
            clientTree.forEach((value, key) => callback(value, key));
        } else {
            console.error("ClientManager: clientTree is not available or does not support iteration (inorder/forEach).");
        }
    },
};
