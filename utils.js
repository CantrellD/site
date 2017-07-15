"use strict";

var utils = (function() {
    var ITR_END = {value: undefined, done: true};
    var helpers = {};
    var helperc = 0;
    var counter = 0;
    var statics = {
        prng: null,
        hideDeprecationMessages: false
    };

///////////////////////////////////////////////////////////////////////////////
// archetypes
///////////////////////////////////////////////////////////////////////////////
    var prng = {
        _lowBits: function(arg, n) {
            var uarg = ui32(arg);
            var ret = ui32(0);
            if (n === 32) {
                ret = ui32(uarg & 0xFFFFFFFF);
            }
            else {
                ret = ui32((ui32(1 << n) - 1) & uarg);
            }
            return ret;
        },
        _product32: function(lhs, rhs) {
            var ulhs = ui32(lhs);
            var urhs = ui32(rhs);
            var ret = ui32(0);
            for (var shift = 0; shift < 32; shift += 4) {
                var nibble = ui32(ulhs * ((urhs >>> shift) & 0xF));
                ret = ui32(ret + ui32(nibble << shift));
            }
            return ret;
        },
        seed: function(arg) {
            this.zval = ui32(arg);
            this.fval = 1812433253;
            this.wval = 32;
            this.nval = 624;
            this.mval = 397;
            this.rval = 31;
            this.aval = 2567483615;
            this.uval = 11;
            this.dval = 4294967295;
            this.sval = 7;
            this.bval = 2636928640;
            this.tval = 15;
            this.cval = 4022730752;
            this.lval = 18;
            this.buf = [];
            this.buf[0] = this.zval;
            for (var i = 1; i < this.nval; i++) {
                var product = this._product32(
                    this.fval,
                    this.buf[i - 1] ^ (this.buf[i - 1] >>> (this.wval - 2))
                )
                var sum = ui32(product + i);
                this.buf.push(this._lowBits(sum, this.wval));
            }
            this.index = this.nval;
        },
        random: function() {
            return ui32(this.randInt32()) * (1.0 / 4294967296.0);
        },
        // Mersenne Twister 19937
        randInt32: function() {
            if (this.index === this.nval) {
                var lmask = this._lowBits(-1, this.rval);
                var hmask = this._lowBits(~lmask, this.wval);
                for (var i = 0; i < this.nval; i++) {
                    var x = ui32(0);
                    x = ui32(x + ui32(this.buf[i] & hmask));
                    x = ui32(x + ui32(this.buf[(i + 1) % this.nval] & lmask));
                    var xa = ui32(x >>> 1);
                    if ((x % 2) !== 0) {
                        xa = ui32(xa ^ this.aval);
                    }
                    this.buf[i] = this.buf[(i + this.mval) % this.nval] ^ xa;
                    this.buf[i] = ui32(this.buf[i]);
                }
                this.index = 0;
            }
            // Deliberately signed to avoid unnecessary operations.
            var y = i32(this.buf[this.index]);
            y = y ^ ((y >>> this.uval) & this.dval);
            y = y ^ ((y << this.sval) & this.bval);
            y = y ^ ((y << this.tval) & this.cval);
            y = y ^ (y >>> this.lval);
            this.index += 1;
            return i32(this._lowBits(y, this.wval));

        },
    };

///////////////////////////////////////////////////////////////////////////////
// cantrips
///////////////////////////////////////////////////////////////////////////////
    helpers.deprecate = function() {
        var src = (new Error).stack.split("\n")[4].trim();
        if (statics.hideDeprecationMessages) {
            return;
        }
        statics.hideDeprecationMessages = true;
        console.log("DeprecationWarning(" + src + ")");
    }
    helperc += 1;

    function $(arg) {
        assert(arg.charAt(0) === "#");
        return [document.getElementById(arg.slice(1))];
    }
    counter += 1;

    function all(conditions) {
        for (var i = 0; i < conditions.length; i++) {
            var condition = conditions[i];
            if (!condition) {
                return false;
            }
        }
        return true;
    }
    counter += 1;

    function any(conditions) {
        for (var i = 0; i < conditions.length; i++) {
            var condition = conditions[i];
            if (condition) {
                return true;
            }
        }
        return false;
    }
    counter += 1;

    function assert(invariant) {
        if (!invariant) {
            var src = (new Error).stack.split("\n")[4].trim();
            throw "AssertionError (" + src + ")";
        }
    }
    counter += 1;

    function identity(arg) {
        return arg;
    }
    counter += 1;

    function ifNaN(arg, fn) {
        if (arg !== arg) {
            fn();
        }
    }
    counter += 1;

    function unlessNaN(arg, fn) {
        if (arg === arg) {
            fn();
        }
    }
    counter += 1;

    function update(target, origin){
        for (var key in origin) {
            if (origin.hasOwnProperty(key)) {
                target[key] = origin[key];
            }
        }
    }
    counter += 1;

    function containsElement(arr, elt) {
        for (var i = 0; i < arr.length; i++) {
            var bothNaN = false;
            if (arr[i] !== arr[i] && elt !== elt) {
                bothNaN = true;
            }
            if (bothNaN || (arr[i] === elt)) {
                return true;
            }
        }
        return false;
    }
    counter += 1;

    function keys(obj) {
        var ret = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                ret.push(key);
            }
        }
        return ret;
    }
    counter += 1;

    function reEscape(str){
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    counter += 1;

    function strSwap(str, a, b) {
        var re = new RegExp(reEscape(b), "g");
        var tmp = [];
        str.split(a).forEach(function(x) {
            tmp.push(x.replace(re, a));
        });
        return tmp.join(b);
    }
    counter += 1;

    function div(lhs, rhs) {
        return i32(lhs / rhs);
    }
    counter += 1;

    function mod(lhs, rhs) {
        return i32(((lhs % rhs) + rhs) % rhs);
    }
    counter += 1;

    function orElse(arg, dflt) {
        return (arg === null) ? dflt : arg;
    }
    counter += 1;

    function setDefault(obj, key, val) {
        if (!(key in obj)) {
            obj[key] = val;
        }
        return obj[key];
    }
    counter += 1;

    function keyEventSourceId(evt) {
        var keyCode = evt.keyCode || evt.which;
        return evt.key || String.fromCharCode(keyCode) || evt.code;
    }
    counter += 1;

///////////////////////////////////////////////////////////////////////////////
// colors
///////////////////////////////////////////////////////////////////////////////

    function hsl2rgb(a,b,c) {
        a *= 6;
        b = [c+=b*=c<.5?c:1-c, c-a%1*b*2, c-=b*=2, c, c+a%1*b, c+b];
        return [b[~~a%6], b[(a|16)%6], b[(a|8)%6]];
    }
    counter += 1;

    function rgb2str(r, g, b) {
        r = (255 * r) | 0;
        g = (255 * g) | 0;
        b = (255 * b) | 0;
        return "rgb(" + r + ", " + g + ", " + b + ")";
    }
    counter += 1;

///////////////////////////////////////////////////////////////////////////////
// iterators
///////////////////////////////////////////////////////////////////////////////

    function cycle(generator) {
        var ret = {};
        var itr = generator();
        ret.next = function() {
            var nxt = itr.next();
            if (nxt.done) {
                itr = generator();
                nxt = itr.next();
            }
            return nxt;
        };
        return ret;
    }
    counter += 1;

    helpers.ipermute = function(arr, depth) {
        var ret = {};
        var fin = false;
        var i = 1;
        var child;
        var src = null;
        if (depth < arr.length - 1) {
            child = helpers.ipermute(arr, depth + 1);
            ret.next = function() {
                var nxt = child.next();
                if (nxt.done) {
                    if (src !== null) {
                        var tmp = arr[src];
                        arr[src] = arr[depth];
                        arr[depth] = tmp;
                    }
                    if (depth + i < arr.length) {
                        src = depth + i;
                        var tmp = arr[depth];
                        arr[depth] = arr[src];
                        arr[src] = tmp;
                        child = helpers.ipermute(arr, depth + 1);
                        nxt = child.next();
                        i += 1;
                    }
                    else {
                        src = null;
                        nxt = ITR_END;
                    }
                }
                return nxt;
            };
        }
        else {
            ret.next = function() {
                if (fin) {
                    return ITR_END;
                }
                else {
                    fin = true;
                    return {value: arr, done: false};
                }
            };
        }
        return ret;
    }
    helperc += 1;

    // TODO: FIXME? Each call to 'next' mutates the object previously returned.
    function permutations(arr, cache) {
        var copy = arr.slice(0);
        return helpers.ipermute(copy, 0);
    }
    counter += 1;

///////////////////////////////////////////////////////////////////////////////
// prng
///////////////////////////////////////////////////////////////////////////////


    function seed(arg) {
        arg = orElse(arg, ui32(Math.random() * 4294967296));
        statics.prng = Object.create(prng, {});
        statics.prng.seed(arg);
    }
    counter += 1;

    function random() {
        if (statics.prng === null) {
            seed(null);
        }
        return statics.prng.random();
    }
    counter += 1;

    function randInt32(cache) {
        if (statics.prng === null) {
            seed(null);
        }
        return statics.prng.randInt32();
    }
    counter += 1;

    function gauss(mu, sigma, cache) {
        var u1;
        var u2;
        var tmp;
        if ("value" in cache && cache.value !== null) {
            tmp = cache.value;
            cache.value = null;
            return tmp * sigma + mu;
        }
        do {
            u1 = 2.0 * random() - 1.0;
            u2 = 2.0 * random() - 1.0;
            tmp = u1 * u1 + u2 * u2;
        } while (tmp === 0 || tmp > 1.0);

        tmp = Math.sqrt((-2.0 * Math.log(tmp)) / tmp);
        cache.value = u2 * tmp;
        return u1 * tmp * sigma + mu;
    }
    counter += 1;

    function shuffle(arr) {
        var n, tmp;
        for (var i = arr.length - 1; i > 0; i--) {
            n = Math.floor(random() * (i + 1));
            tmp = arr[i];
            arr[i] = arr[n];
            arr[n] = tmp;
        }
    }
    counter += 1;

///////////////////////////////////////////////////////////////////////////////
// sorting
///////////////////////////////////////////////////////////////////////////////

    function insertionSort(arr, cmp) {
        for (var i = 1; i < arr.length; i++) {
            var j = i;
            var t = arr[j];
            while (j > 0 && cmp(arr[j - 1], t) > 0) {
                arr[j] = arr[j - 1];
                j -= 1;
            }
            arr[j] = t;
        }
        return arr;
    }
    counter += 1;

    helpers.merge = function(src, dst, a, b, c, cmp) {
        var i = a;
        var j = b;
        var k = a;
        while (k < c) {
            if (i === b) {
                dst[k] = src[j];
                k++;
                j++;
            }
            else if (j === c) {
                dst[k] = src[i];
                k++;
                i++;
            }
            else if (cmp(src[i], src[j]) > 0) {
                dst[k] = src[j];
                k++;
                j++;
            }
            else {
                dst[k] = src[i];
                k++;
                i++;
            }
        }
    }
    helperc += 1;

    function mergeSort(arr, cmp) {
        var copy = arr.slice(0);
        function impl(x, y, a, b, c) {
            if (a === c) {
                return;
            }
            if (b - a > 1) {
                impl(y, x, a, (a + b) >> 1, b);
            }
            if (c - b > 1) {
                impl(y, x, b, (b + c) >> 1, c);
            }
            helpers.merge(x, y, a, b, c, cmp);
        }
        impl(copy, arr, 0, arr.length >> 1, arr.length);
        return arr;
    }
    counter += 1;

///////////////////////////////////////////////////////////////////////////////
// types
///////////////////////////////////////////////////////////////////////////////

    function i32(arg) {
        return arg | 0;
    }
    counter += 1;

    function ui32(arg) {
        return arg >>> 0;
    }
    counter += 1;

    function forceBool(arg) {
        return (arg.toString() === "true");
    }
    counter += 1;

    function forceInt(arg) {
        return parseInt(arg.toString()) || 0;
    }
    counter += 1;

    function forceFloat(arg) {
        return parseFloat(arg.toString()) || 0.0;
    }
    counter += 1;

///////////////////////////////////////////////////////////////////////////////
// uri
///////////////////////////////////////////////////////////////////////////////
    function uriEncode(str, subs) {
        var tmp = str;
        for (var i = subs.length - 1; i >= 0; i--) {
            var sub = subs[i];
            tmp = strSwap(tmp, sub[0], sub[1]);
        }
        return encodeURIComponent(tmp);
    }
    counter += 1;

    function uriDecode(str, subs) {
        var tmp = decodeURIComponent(str);
        for (var i = 0; i < subs.length; i++) {
            var sub = subs[i];
            tmp = strSwap(tmp, sub[0], sub[1]);
        }
        return tmp;
    }
    counter += 1;

    function uri2data(uri, subs) {
        var uri_suffix = uri.match(/^[^?]*[?](.*)$/);
        var ret = {};
        if (uri_suffix !== null) {
            uri_suffix[1].split("&").forEach(function(x) {
                var tmp = x.match(/^([a-z_]+)[=](.*)$/);
                if (tmp !== null) {
                    var key = uriDecode(tmp[1], subs);
                    var val = JSON.parse(uriDecode(tmp[2], subs));
                    if (!(key in ret)) {
                        ret[key] = val;
                    }
                }
            });
        }
        return ret;
    }
    counter += 1;

    function data2uri(data, subs, uri_prefix) {
        var tmp = [];
        for (var x in data) {
            if (data.hasOwnProperty(x)) {
                var key = uriEncode(x, subs);
                var val = uriEncode(JSON.stringify(data[x]), subs);
                tmp.push(key + "=" + val);
            }
        }
        return uri_prefix + tmp.join("&");
    }
    counter += 1;

    var ret = {
        $: $,
        all: all,
        any: any,
        assert: assert,
        containsElement: containsElement,
        cycle: cycle,
        data2uri: data2uri,
        div: div,
        forceBool: forceBool,
        forceFloat: forceFloat,
        forceInt: forceInt,
        gauss: gauss,
        keys: keys,
        hsl2rgb: hsl2rgb,
        i32: i32,
        identity: identity,
        ifNaN: ifNaN,
        insertionSort: insertionSort,
        keyEventSourceId: keyEventSourceId,
        keys: keys,
        mergeSort: mergeSort,
        mod: mod,
        orElse: orElse,
        permutations: permutations,
        randInt32: randInt32,
        random: random,
        reEscape: reEscape,
        rgb2str: rgb2str,
        seed: seed,
        setDefault: setDefault,
        shuffle: shuffle,
        strSwap: strSwap,
        ui32: ui32,
        unlessNaN: unlessNaN,
        update: update,
        uri2data: uri2data,
        uriDecode: uriDecode,
        uriEncode: uriEncode,
    };
    if (keys(helpers).length !== helperc || keys(ret).length !== counter) {
        console.log("WARNING: The utils module has an invalid state.");
    }
    return ret;
})();
