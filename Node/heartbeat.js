// Node/heartbeat.js

const initializeHeartbeat = (getIOInstance, clientManager, spamUtils, config, utils) => {
    let hbeat = true; // Internal state, can be made configurable if needed
    let completed = true; // Internal state for heartbeat cycle completion

    const heartbeat = () => {
        if (!completed) {
            // console.log("Heartbeat: Previous cycle did not complete.");
        }
        completed = false;

        const ioInstance = getIOInstance();
        if (!ioInstance) {
            console.error("Heartbeat: IO instance is not available.");
            completed = true;
            return;
        }
        
        // Accessing clientTree requires a method from clientManager
        // Assuming clientManager provides a way to iterate over clients, e.g., clientManager.forEachClient
        if (!clientManager || typeof clientManager.forEachClient !== 'function') {
            console.error("Heartbeat: clientManager is invalid or does not have forEachClient method.");
            completed = true;
            return;
        }

        clientManager.forEachClient((client_data, socket_id) => { // Iterate with (value, key)
            if (!client_data) {
                // This can happen if a client was deleted during iteration, though less likely with a copy.
                // Or if forEachClient provides null/undefined for some reason.
                return; 
            }

            // Forward queue (to next relay or service)
            if (client_data.next && client_data.next.socket && typeof client_data.next.socket.emit === 'function') {
                const forwardQueue = client_data.next.queue; // Assuming client_data.next is the forwardLink object
                let msgToSend;
                if (hbeat) {
                    msgToSend = utils.isValidQueue(forwardQueue) ? forwardQueue.dequeue() : { event: 'x', data: { x: spamUtils.getSpam() } };
                } else {
                    if (utils.isValidQueue(forwardQueue)) {
                        msgToSend = forwardQueue.dequeue();
                    }
                }
                if (msgToSend && msgToSend.event && msgToSend.data) {
                    client_data.next.socket.emit(msgToSend.event, msgToSend.data);
                }
            }

            // Backward queue (to the original client connected to this server)
            const backwardQueue = client_data.queue;
            let msgToReturn;
            const clientSocket = ioInstance.sockets.sockets.get(socket_id);

            if (clientSocket) {
                if (hbeat) {
                    msgToReturn = utils.isValidQueue(backwardQueue) ? backwardQueue.dequeue() : { event: 'x', data: { x: spamUtils.getSpam() } };
                } else {
                    if (utils.isValidQueue(backwardQueue)) {
                        msgToReturn = backwardQueue.dequeue();
                    }
                }
                if (msgToReturn && msgToReturn.event && msgToReturn.data) {
                    clientSocket.emit(msgToReturn.event, msgToReturn.data);
                }
            }
        });
        completed = true;
    };

    const startHeartbeat = () => {
        setInterval(heartbeat, config.heartbeatInterval);
        console.log(`Heartbeat started with interval: ${config.heartbeatInterval}ms. hbeat status: ${hbeat}`);
    };
    
    const toggleHbeat = (status) => { // Optional: function to toggle hbeat if needed externally
        if (typeof status === 'boolean') {
            hbeat = status;
            console.log(`Heartbeat hbeat status set to: ${hbeat}`);
        } else {
            hbeat = !hbeat;
            console.log(`Heartbeat hbeat status toggled to: ${hbeat}`);
        }
    };

    return {
        startHeartbeat,
        // toggleHbeat, // Expose if external control over hbeat is desired
    };
};

module.exports = { initializeHeartbeat };
