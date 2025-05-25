// Note: path is passed from server.js, publicPath is constructed here for directoryWrite
// localAddress is also passed from server.js for 'presence server' emit

const initializeSocketIO = (io, directoryUtils, publicPath, getLocalAddress) => {
    io.sockets.on('connection', (socket) => {
        socket.on('register_node', (data) => {
            // Use directoryUtils.nodes, directoryUtils.creds directly as they are exported as mutable
            const i = directoryUtils.findNode(socket.id);
            if (i === -1) {
                console.log("node connected");
                const node = { id: socket.id };
                directoryUtils.nodes.push(node);
                const n = { host: data.host, port: data.port, publicKey: data.pk };
                directoryUtils.creds.push(n);
                directoryUtils.directoryWrite(publicPath, directoryUtils.creds);

                const presence_server_data = { presence_server_address: getLocalAddress() };
                if (directoryUtils.presence_servers.length > 0) {
                    presence_server_data.presence_server_address = directoryUtils.presence_servers[0].address;
                }
                socket.emit('presence server', presence_server_data);
            }
        });

        socket.on('register_presence_server', (data) => {
            const i = directoryUtils.findPresenceServer(socket.id);
            if (i === -1) {
                console.log("presence server connected");
                const presence_server = { id: socket.id, address: data.address };
                console.log(`Address\t${data.address}`);
                directoryUtils.presence_servers.push(presence_server);

                if (directoryUtils.presence_servers.length === 1) {
                    const presence_server_data = { presence_server_address: data.address };
                    for (let j = 0; j < directoryUtils.nodes.length; j++) {
                        const tempClient = io.sockets.sockets.get(directoryUtils.nodes[j].id);
                        if (tempClient) {
                            tempClient.emit('presence server', presence_server_data);
                        }
                    }
                }
            }
        });

        socket.on('disconnect', () => {
            let i = directoryUtils.findNode(socket.id);
            if (i !== -1) {
                directoryUtils.nodes.splice(i, 1);
                directoryUtils.creds.splice(i, 1);
                directoryUtils.directoryWrite(publicPath, directoryUtils.creds);
            }

            i = directoryUtils.findPresenceServer(socket.id);
            if (i !== -1) {
                directoryUtils.presence_servers.splice(i, 1);
            }
        });
    });
};

module.exports = { initializeSocketIO };
