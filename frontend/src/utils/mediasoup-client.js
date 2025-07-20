import { Device } from 'mediasoup-client';

export const createDevice = () => new Device();

export const loadDevice = async (routerRtpCapabilities, device) => {
    try {
        if (device.loaded) {
            console.warn("Device is already loaded.");
            return;
        }
        await device.load({ routerRtpCapabilities });
    } catch (error) {
        if (error.name === 'UnsupportedError') {
            console.error('Browser not supported for WebRTC.');
        } else {
            console.error("Failed to load device:", error);
        }
        throw error;
    }
};

export const createSendTransport = async (socket, device, roomId) => {
    const transportOptions = await new Promise((resolve, reject) => {
        socket.emit('create-webrtc-transport', { roomId, isSender: true }, (options) => {
            if (options.error) {
                reject(new Error(options.error));
            } else {
                resolve(options);
            }
        });
    });

    const transport = device.createSendTransport(transportOptions);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit('connect-transport', { transportId: transport.id, dtlsParameters }, ({ success, error }) => {
            if (success) {
                callback();
            } else {
                errback(new Error(error || 'Failed to connect transport on server-side.'));
            }
        });
    });

    transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
            socket.emit('produce', { kind, rtpParameters, transportId: transport.id, appData }, ({ id, error }) => {
                if (id) {
                    callback({ id });
                } else {
                    errback(new Error(error || 'Failed to create producer on server-side.'));
                }
            });
        } catch (error) {
            errback(error);
        }
    });

    return transport;
};

export const createRecvTransport = async (socket, device, roomId) => {
    const transportOptions = await new Promise((resolve, reject) => {
        socket.emit('create-webrtc-transport', { roomId, isSender: false }, (options) => {
            if (options.error) {
                reject(new Error(options.error));
            } else {
                resolve(options);
            }
        });
    });

    const transport = device.createRecvTransport(transportOptions);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit('connect-transport', { transportId: transport.id, dtlsParameters }, ({ success, error }) => {
            if (success) {
                callback();
            } else {
                errback(new Error(error || 'Failed to connect transport on server-side.'));
            }
        });
    });

    return transport;
};

export const consumeStream = async (socket, device, transport, producerId, rtpCapabilities) => {
    const { id, kind, rtpParameters, error } = await new Promise(resolve => {
        socket.emit('consume', { producerId, rtpCapabilities, transportId: transport.id }, resolve);
    });

    if (error) {
        console.error('Cannot consume stream:', error);
        throw new Error(error);
    }

    const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
    });

    socket.emit('resume-consumer', { consumerId: consumer.id });

    const stream = new MediaStream();
    stream.addTrack(consumer.track);

    return { consumer, stream };
};