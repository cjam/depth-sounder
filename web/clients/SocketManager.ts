///<reference path="all.d.ts"/>

import Socket = SocketIOClient.Socket;
var socketOptions:SocketIOClient.ConnectOpts = {
    multiplex: true,
    port: location.port,
    hostname: location.hostname,
}

class SocketManager {
    private static sockets:{[id:string]:Socket;} = {}

    static GetSocket(nameSpace:string = "/"):Socket {
        if (this.sockets[nameSpace] == undefined) {
            this.sockets[nameSpace] = io(nameSpace);
        }

        return this.sockets[nameSpace];
    }
}