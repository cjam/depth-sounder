///<reference path="all.d.ts"/>

Object.defineProperty(Boolean.prototype, "equals", {
    enumerable: false,
    configurable: true,
    value: function (c) {
        return this == c;
    }
});

Object.defineProperty(Number.prototype, "equals", {
    enumerable: false,
    configurable: true,
    value: function (c) {
        if (Number.prototype.equals.NaN == true && isNaN(this) && c != c) return true;
        return this == c;
    }
});

Number.prototype.equals.NaN = false; //Set to true to return true for NaN == NaN

Object.defineProperty(String.prototype, "equals", {
    enumerable: false,
    configurable: true,
    value: Boolean.prototype.equals
});

Object.defineProperty(Object.prototype, "equals", {
    enumerable: false,
    configurable: true,
    value: function (c, reference) {
        if (true === reference)
            return this === c;
        if (typeof this != typeof c) {
            return false;
        }
        var d = [Object.keys(this), Object.keys(c)],
            f = d[0].length;
        if (f !== d[1].length) {
            return false;
        }
        for (var e = 0; e < f; e++) {
            if (d[0][e] != d[1][e] || !this[d[0][e]].equals(c[d[1][e]])) {
                return false;
            }
        }
        return true;
    }
});
Object.defineProperty(Array.prototype, "equals", {
    enumerable: false,
    configurable: true,
    value: function (c, reference) {

        var d = this.length;
        if (d != c.length) {
            return false;
        }
        var f = Array.prototype.equals.sort(this.concat());
        c = Array.prototype.equals.sort(c.concat(), f)

        if (reference) {
            for (var e = 0; e < d; e++) {
                if (f[e] != c[e] && !(Array.prototype.equals.NaN && f[e] != f[e] && c[e] != c[e])) {
                    return false;
                }
            }
        } else {
            for (var e = 0; e < d; e++) {
                if (!f[e].equals(c[e])) {
                    return false;
                }
            }
        }
        return true;

    }
});

Array.prototype.equals.NaN = false; //Set to true to allow [NaN].equals([NaN]) //true

Object.defineProperty(Array.prototype.equals, "sort", {
    enumerable: false,
    value: function sort(curr, prev) {
        var weight = {
            "[object Undefined]": 6,
            "[object Object]": 5,
            "[object Null]": 4,
            "[object String]": 3,
            "[object Number]": 2,
            "[object Boolean]": 1
        }
        if (prev) { //mark the objects
            for (var i = prev.length, j, t; i > 0; i--) {
                t = typeof (j = prev[i]);
                if (j != null && t === "object") {
                    j._pos = i;
                } else if (t !== "object" && t != "undefined") break;
            }
        }

        curr.sort(sorter);

        if (prev) {
            for (var k = prev.length, l, t; k > 0; k--) {
                t = typeof (l = prev[k]);
                if (t === "object" && l != null) {
                    delete l._pos;
                } else if (t !== "object" && t != "undefined") break;
            }
        }
        return curr;

        function sorter(a, b) {

            var tStr = Object.prototype.toString
            var types = [tStr.call(a), tStr.call(b)]
            var ret = [0, 0];
            if (types[0] === types[1] && types[0] === "[object Object]") {
                if (prev) return a._pos - b._pos
                else {
                    return a === b ? 0 : 1;
                }
            } else if (types [0] !== types [1]) {
                return weight[types[0]] - weight[types[1]]
            }
            return a > b ? 1 : a < b ? -1 : 0;
        }

    }

});