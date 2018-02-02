"use strict";

var utils = (function() {
    var ITR_END = {value: undefined, done: true};
    var helpers = {};
    var helperc = 0;
    var counter = 0;
    var statics = {
        seed: null,
    };

///////////////////////////////////////////////////////////////////////////////
// cantrips
///////////////////////////////////////////////////////////////////////////////

    function deprecate() {
        var src = (new Error).stack;
        console.log("DeprecationWarning(" + src + ")");
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

    function sum(arr) {
        var ret = 0;
        for (var i = 0; i < arr.length; i++) {
            ret += arr[i];
        }
        return ret;
    }
    counter += 1;

    function assert(invariant) {
        if (!invariant) {
            var src = (new Error).stack;
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

    function factorial(arg) {
        var counter = null;
        var ret = null;
        var copy = arg;
        var index = 0;
        if (!factorial.hasOwnProperty("memo")) {
            factorial.memo = [1];
        }
        while (copy > 1 && index < factorial.memo.length - 1) {
            index += 1;
            copy = copy >>> 1;
        }
        counter = Math.pow(2, index);
        ret = factorial.memo[index];

        while (counter < arg) {
            counter += 1;
            ret = ret * counter;
            if (counter === Math.pow(2, factorial.memo.length)) {
                factorial.memo.push(ret);
            }
        }
        return ret;
    }
    counter += 1;

    function orElse(arg, dflt) {
        return (arg === null) ? dflt : arg;
    }
    counter += 1;

    function setDefault(obj, key, val) {
        if (!obj.hasOwnProperty(key)) {
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

    function permutations(arr) {
        var copy = null;
        var counters = [];
        var count = factorial(arr.length);
        for (var i = 0; i < arr.length; i++) {
            counters[i] = i;
        }
        function update(arr, n) {
            var src = counters[n];
            var dst = (src > 0) ? src - 1 : n;
            var buf = (src > 0) ? arr[dst] : arr[src];
            if (src > 0) {
                arr[dst] = arr[src];
                arr[src] = buf;
            }
            else {
                arr.splice(0, 1);
                arr.splice(dst, 0, buf);
            }
            counters[n] -= 1;
            if (counters[n] < 0) {
                counters[n] = n;
                update(arr, n - 1);
            }
        }
        function next() {
            if (count === 0) {
                return {value: null, done: true};
            }
            if (copy === null) {
                copy = arr.slice();
            }
            else {
                update(copy, copy.length - 1);
            }
            count -= 1;
            return {value: copy.slice(), done: false};
        }
        return {next: next};
    }
    counter += 1;

///////////////////////////////////////////////////////////////////////////////
// prng
///////////////////////////////////////////////////////////////////////////////

    function seed(arg) {
        statics.seed = orElse(arg, ui32(Math.random() * 4294967296));
        mt19937.init_genrand(statics.seed);
    }
    counter += 1;

    function random() {
        if (statics.seed === null) {
            seed(null);
        }
        return ui32(randInt32()) * (1.0 / 4294967296.0);
    }
    counter += 1;

    function randInt32() {
        if (statics.seed === null) {
            seed(null);
        }
        return mt19937.genrand_int32();
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

    // This resolves the "Unicode Problem" associated with the btoa function.
    function ab2base64str(arg) {
        var src = new Uint8Array(arg);
        var dst = [];
        for (var i = 0; i < src.length; i++) {
            dst.push(String.fromCharCode(src[i]));
        }
        return btoa(dst.join(""));
    }
    counter += 1;

    function base64str2ab(arg) {
        var src = atob(arg);
        var buf = new ArrayBuffer(src.length);
        var dst = new Uint8Array(buf);
        for (var i = 0; i < src.length; i++) {
            dst[i] = src.charCodeAt(i);
        }
        return buf;
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

///////////////////////////////////////////////////////////////////////////////
// zen
///////////////////////////////////////////////////////////////////////////////

    var ret = {
        ab2base64str: ab2base64str,
        all: all,
        any: any,
        assert: assert,
        base64str2ab: base64str2ab,
        containsElement: containsElement,
        cycle: cycle,
        data2uri: data2uri,
        deprecate: deprecate,
        div: div,
        factorial: factorial,
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
        sum: sum,
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