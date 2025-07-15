import { Device } from 'mediasoup-client';

export const createDevice = () => new Device();

export const loadDevice = async (routerRtpCapabilities, device) => {
    await device.load({ routerRtpCapabilities });
};

export const createSendTransport = async (socket, device, roomId) => {
    const transportOptions = await new Promise(resolve => {
        socket.emit('create-webrtc-transport', { roomId, isSender: true }, resolve);
    });
    const transport = device.createSendTransport(transportOptions);

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        socket.emit('connect-transport', { transportId: transport.id, dtlsParameters }, ({ success }) => {
            if (success) {
                callback();
            } else {
                errback(new Error('Failed to connect transport'));
            }
        });
    });

    transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
            socket.emit('produce', { kind, rtpParameters, transportId: transport.id, appData }, ({ id }) => {
                if (id) {
                    callback({ id });
                } else {
                    errback(new Error('Failed to produce'));
                }
            });
        } catch(error) {
            errback(error);
        }
    });

    return transport;
};

export const createRecvTransport = async (socket, device, roomId) => {
    const transportOptions = await new Promise(resolve => {
        socket.emit('create-webrtc-transport', { roomId, isSender: false }, resolve);
    });
    const transport = device.createRecvTransport(transportOptions);

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        socket.emit('connect-transport', { transportId: transport.id, dtlsParameters }, ({ success }) => {
            if (success) {
                callback();
            } else {
                errback(new Error('Failed to connect transport'));
            }
        });
    });

    return transport;
};

export const consumeStream = async (socket, device, transport, producerId, rtpCapabilities) => {
    const { id, kind, rtpParameters } = await new Promise(resolve => {
        socket.emit('consume', { producerId, rtpCapabilities, transportId: transport.id }, resolve);
    });

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