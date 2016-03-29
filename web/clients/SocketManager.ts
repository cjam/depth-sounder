///<reference path="all.d.ts"/>

import Socket = SocketIOClient.Socket;
var socketOptions:SocketIOClient.ConnectOpts = {
    multiplex: true,
    port: location.port,
    hostname: location.hostname,
}

declare class SharedWorker {
    constructor(scriptUri:string, name:string);

    port:{
        onmessage : Function;
        start();
        postMessage(message:any);
    }
    onerror:Function;
}

// declaration of the component-emitter class
declare class Emitter {
    on(event:string, fn:Function);

    addEventListener(event:string, fn:Function);

    once(event:string, fn:Function);

    off(event:string, fn:Function);

    removeListener(event:string, fn:Function);

    removeAllListeners(event:string, fn:Function);

    removeEventListener(event:string, fn:Function);

    emit(event:string, args:any[]);

    listeners(event:string):Function[];

    hasListeners(event:string):boolean;
}

interface ISocket extends Emitter {
    close();
}

const SharedWorkerUri:string = "/static/sharedSocketWorker.js";

interface ISharedSocketMessage {
    type:string;
    message:any;
}

class SharedSocket extends Emitter implements ISocket {
    private worker:SharedWorker;
    private messageSubject:Rx.Subject<ISharedSocketMessage>;

    constructor(private ioNamespace:string = "/") {
        super();
        let self = this;
        this.messageSubject = new Rx.Subject<ISharedSocketMessage>();
        this.worker = new SharedWorker(SharedWorkerUri, ioNamespace);

        this.worker.port.onmessage = function (e) {
            self.messageSubject.onNext(e.data);
        };

        this.worker.onerror = function (evt) {
            console.error("SharedSocket Error:", evt);
        }

        this.messageSubject.asObservable().throttle(20).subscribe((d)=> {
            self.onMessage(d.type, d.message);
        });

        this.worker.port.start();
    }

    private onMessage(type:string, message:any) {
        let eventName = type;
        switch (type) {
            case '_connect':
                eventName = 'connect';
                break;
            case '_disconnect':
                eventName = 'disconnect';
                break;
        }
        this.emit(eventName, message);
    }

    private sharedSubscribe(eventName:string) {
        // if we're just starting to listen, then wire up to worker
        if (!this.hasListeners(eventName)) {
            this.worker.port.postMessage({eventName: eventName});
        }
    }

    public on(eventName:string, callback:Function) {
        this.sharedSubscribe(eventName);
        super.on(eventName, callback);
    }

    public addEventListener(eventName:string, callback:Function) {
        this.sharedSubscribe(eventName);
        super.addEventListener(eventName, callback);
    }

    public once(eventName:string, callback:Function) {
        this.sharedSubscribe(eventName);
        super.once(eventName, callback);
    }

    public close() {
        throw new Error("Not Implemented");
    }
}


class SocketManager {
    private static sockets:{[id:string]:ISocket;} = {}

    static GetSocket(nameSpace:string = "/"):ISocket {
        if (this.sockets[nameSpace] == undefined) {
            this.sockets[nameSpace] = SocketManager.CreateSocket(nameSpace);
        }

        return this.sockets[nameSpace];
    }

    private static CreateSocket(ns:string = "/"):ISocket {
        if (window.SharedWorker) {
            return new SharedSocket(ns);
        } else {
            return io(ns);
        }
    }

    static Dispose() {
        for (var index in this.sockets) {
            if (!this.sockets.hasOwnProperty(index)) {
                continue;
            }
            // close the socket
            this.sockets[index].close();
        }
        this.sockets = {};
    }
}


window.addEventListener("onbeforeunload", (e)=> {
    console.log("cleaning up sockets");
    SocketManager.Dispose();
});
