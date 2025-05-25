const RBTree = require('./rbtree'); // Assuming rbtree.js is in the same directory

// Comparison function for RBTree
const cmp = (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    if (a === b) return 0; // Use === for strict equality
    return 0; // Default for safety, though cmp should handle all cases for its inputs
};

// Tree instances
let clientTreeID = new RBTree(cmp);
let nextClientTreeID = new RBTree(cmp);
let connectionTreeID = new RBTree(cmp);
let nextConnectionTreeID = new RBTree(cmp);
let clientTree = new RBTree(cmp);
let nextClientTree = new RBTree(cmp);
let connectionTree = new RBTree(cmp);
let nextConnectionTree = new RBTree(cmp);
let keyTree = new RBTree(cmp); // Stores 'identifier' objects

// Object prototypes/factories
// Using functions to create these objects to ensure fresh instances
const createClientObject = (username = null, id = null) => ({
    username,
    id,
});

const createConnectionObject = (connection_id = null, id = null) => ({
    connection_id,
    id,
});

const createIdentifierObject = (id = null, key = null, pid = null) => ({
    id,
    key,
    pid,
    encrypt_iv: "////////////",
    decrypt_iv: "AAAAAAAAAAAA",
    queue: [], // Initialize as an empty array
    message_array: [], // Initialize as an empty array
});

// Timestamp management
let timeStamp = Math.floor(new Date() / (60000 * 1000)); // epoch_length of 1000 minutes

const getTimeStamp = () => Math.floor(new Date() / (60000 * 1000));

const checkTimeStamp = () => {
    if (timeStamp !== getTimeStamp()) {
        timeStamp = getTimeStamp();

        clientTree = nextClientTree;
        nextClientTree = new RBTree(cmp);

        connectionTree = nextConnectionTree;
        nextConnectionTree = new RBTree(cmp);

        // Note: clientTreeID and connectionTreeID are not reset/swapped here in original code.
        // This might be intentional or an oversight. For now, following original logic.
        // If they also need to be epoch-based, their handling would need adjustment.
        console.log("Timestamp checked, epoch updated for clientTree and connectionTree.");
    }
};


// Management functions
const addKey = (socket_id, keyData) => { // keyData is an identifier object
    keyTree.put(socket_id, keyData);
};

const findIdentifier = (socket_id) => {
    return keyTree.get(socket_id);
};

const findKey = (socket_id) => {
    const identifier = keyTree.get(socket_id);
    return identifier ? identifier.key : null;
};

const addClient = (newClient) => { // newClient is an object from createClientObject
    clientTreeID.put(newClient.id, newClient.username);
    clientTree.put(newClient.username, newClient);
};

const addFutureClient = (newClient) => {
    nextClientTreeID.put(newClient.id, newClient.username);
    nextClientTree.put(newClient.username, newClient);
};

const addConnection = (newConnection) => { // newConnection from createConnectionObject
    connectionTreeID.put(newConnection.id, newConnection.connection_id);
    connectionTree.put(newConnection.connection_id, newConnection);
};

const addFutureConnection = (newConnection) => {
    nextConnectionTreeID.put(newConnection.id, newConnection.connection_id);
    nextConnectionTree.put(newConnection.connection_id, newConnection);
};

const checkPresence = (username) => {
    return clientTree.get(username);
};

const checkFuturePresence = (username) => {
    return nextClientTree.get(username);
};

const checkConnection = (username) => { // username here means connection_id
    return connectionTree.get(username);
};

const checkFutureConnection = (username) => { // username here means connection_id
    return nextConnectionTree.get(username);
};

// findClient in lp.js was: clientTree.get(clientTreeID.get(id));
// Renaming to findClientBySocketId to be more descriptive
const findClientBySocketId = (socket_id) => {
    const username = clientTreeID.get(socket_id);
    if (username) {
        return clientTree.get(username);
    }
    return null;
};

let userCount = 0; // To replace global 'count'

const removeIdPresence = (socket_id) => {
    keyTree.delete(socket_id); // Remove identifier first

    const usernameCurrent = clientTreeID.get(socket_id);
    if (usernameCurrent) {
        clientTreeID.delete(socket_id);
        clientTree.delete(usernameCurrent);
        userCount--;
        console.log(`${usernameCurrent} removed. ${userCount} users.`);
    }

    const usernameNext = nextClientTreeID.get(socket_id);
    if (usernameNext) {
        nextClientTreeID.delete(socket_id);
        nextClientTree.delete(usernameNext);
    }
    // This also calls remove_contact_pair in the original, so let's keep that logic
    removeContactPair(socket_id);
};

const removeContactPair = (socket_id) => {
    const connectionIdCurrent = connectionTreeID.get(socket_id);
    if (connectionIdCurrent) {
        connectionTreeID.delete(socket_id);
        connectionTree.delete(connectionIdCurrent);
    }

    const connectionIdNext = nextConnectionTreeID.get(socket_id);
    if (connectionIdNext) {
        nextConnectionTreeID.delete(socket_id);
        nextConnectionTree.delete(connectionIdNext);
    }
};

const incrementUserCount = () => {
    userCount++;
};

const getUserCount = () => userCount;


// Expose only what's needed. RBTree instances are kept internal.
module.exports = {
    // Object creation
    createClientObject,
    createConnectionObject,
    createIdentifierObject,
    // Timestamp
    checkTimeStamp, // To be called by setInterval in main
    // Identifier/Key Management
    addKey,
    findIdentifier,
    findKey, // Potentially useful for socket-handlers
    // Client/Connection Management
    addClient,
    addFutureClient,
    addConnection,
    addFutureConnection,
    checkPresence,
    checkFuturePresence,
    checkConnection,
    checkFutureConnection,
    findClientBySocketId,
    removeIdPresence, // Handles removing from keyTree, client trees, and calls removeContactPair
    // User count management
    incrementUserCount,
    getUserCount,
    // keyTree is needed by heartbeat, so we should expose it or a function to iterate it
    // Exposing it directly for now, as heartbeat iterates it.
    keyTree,
};
