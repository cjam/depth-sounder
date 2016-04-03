"use strict";

importScripts('http://cdn.socket.io/socket.io-1.1.0.js');

var socket = io(self.name),
    ports = [];

onconnect = function (connectEvt) {
    var port = connectEvt.ports[0];
    ports.push(port);

    port.onmessage = function (subscription) {
        var eventName = subscription.data.eventName;
        socket.on(eventName, function (msg) {
            port.postMessage({type: eventName, message: msg});
        });
        port.postMessage({type: "_listening", message: eventName})
    }

    if (socket.connected) {
        port.postMessage({type: "_connect", message: {}})
    }

    port.start();
};

function broadcastEvent(eventName, msg) {
    for (var i = 0; i < ports.length; i++) {
        ports[i].postMessage({type: eventName, message: msg});
    }
}

socket.on('connect', function () {
    broadcastEvent("_connect", {});
})

socket.on('disconnect', function () {
    broadcastEvent("_disconnect", {});
})