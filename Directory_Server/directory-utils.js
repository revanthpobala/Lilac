const fs = require('fs');

let nodes = [];
let creds = [];
let presence_servers = [];

const directoryWrite = (publicPath, currentCreds) => {
    const nodesString = JSON.stringify(currentCreds);
    // Note: path.join should be used ideally, but publicPath is already __dirname + '/public'
    const filePath = publicPath + '/creds.json'; 
    const file = fs.createWriteStream(filePath);
    file.on('error', (err) => {
        console.error("Error while writing to creds.json:", err);
    });
    file.write(nodesString);
    file.end();
};

const findNode = (id) => {
    return nodes.findIndex(node => node.id === id);
};

const findPresenceServer = (id) => {
    return presence_servers.findIndex(ps => ps.id === id);
};

// Export an object containing the arrays and functions
// This allows mutating the arrays (nodes, creds, presence_servers) from outside,
// which is needed by socket-handlers.js
module.exports = {
    nodes,
    creds,
    presence_servers,
    directoryWrite,
    findNode,
    findPresenceServer
};
