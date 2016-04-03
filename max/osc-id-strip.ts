///<reference path="max.d.ts"/>

/*
 simple javascript string case conversion object
 */

// set up inlets/outlets/assist strings
setinletassist(0, "osc route to strip id from");
setoutletassist(0, "remaining osc route after id removed");

post("Compiled osc-id-strip.js");

var idToStrip = jsarguments[1];
if (idToStrip == undefined) {
    throw new Error("Id must be specified as argument")
}

function stripId(address, value) {
    var stripped = address.replace("/" + idToStrip, "");
    if (stripped != address) {
        outlet(0, [stripped, value]);
    }
}

