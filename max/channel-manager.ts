///<reference path="max.d.ts"/>


var maxconsole = {
    log: function (msg:any) {
        post(msg + "\n");
    }
}

var channelPatcher;
var channels:{[id:string] : MaxObject} = {};
var numChannels = 0;

// Parsing Initial Arguments
if (jsarguments.length > 1) {
    channelPatcher = jsarguments[1];
} else {
    throw new Error("Second argument to js channel-manager.js should be the name of the channel-patcher")
}

var offsetX = jsarguments[2] || 0;
var offsetY = jsarguments[3] || 0;

var channelWidth = 87;
var channelHeight = 202;

maxconsole.log("Using '" + channelPatcher + "' as patcher for new channels");
maxconsole.log("patcher offset: " + offsetX + "," + offsetY);

// Functionality

function addChannel(id) {
    if (channels[id] == undefined) {
        maxconsole.log("Adding channel " + id)
        var channel = createChannel(id);
        channels[id] = channel;
        numChannels++;
        outlet(0, numChannels);
    } else {
        maxconsole.log("Channel " + id + " has already been added");
    }
}

function createChannel(id) {
    var patcherArgs = new Array();
    patcherArgs.push(channelPatcher);
    patcherArgs.push("@args");
    patcherArgs.push(id);
    var channel = this.patcher.newdefault(0, 0, "bpatcher", patcherArgs);
    channel.rect = [offsetX + channelWidth * numChannels, offsetY, offsetX + channelWidth * (numChannels + 1), offsetY + channelHeight]

    //channel.rect = [offsetX, offsetY, offsetX + channelWidth * (numChannels + 1), channelHeight];
    channel.varname = id;
    return channel;
}

function removeChannel(id) {
    var channel = channels[id];
    if (channel != undefined) {
        maxconsole.log("Removing channel " + id)
        disposeChannel(channel);
        delete channels[id];
        numChannels--;
        outlet(0, numChannels);
    } else {
        maxconsole.log("Couldn't find channel" + id)
    }

}

function disposeChannel(channelObj:MaxObject) {
    if (channelObj != undefined) {
        try {
            channelObj.dispose();
            this.patcher.remove(channelObj);
        } catch (Exception) {
            // not ideal
        }
    }
}

function clear() {
    maxconsole.log("Clearing out all channels");
    for (var chId in channels) {
        var ch = channels[chId];
        disposeChannel(ch);
    }
    channels = {};
    numChannels = 0;
    outlet(0, numChannels);
}

function sendtobox(name:string, args:any) {
    var i;
    var a = new Array();

    // send any message the box understands to the box
    //if (vbox) {
    //	if (vbox.understands(arguments[0])) {
    //		for (i=0;i<(arguments.length-1);i++)
    //			a[i] = arguments[i+1];
    //		vbox[arguments[0]](a);
    //	} else if (vbox.understands("sendbox")) {
    //		for (i = 0; i < arguments.length; i++)
    //			a[i] = arguments[i];
    //		vbox["sendbox"](a);
    //	} else {
    //		maxconsole.log("doesn't understand " + arguments[0]);
    //	}
    //}
}