"use strict";

// Degree: Index into a scale.
// Tone: Relative pitch, integer number of semitones.
// Note: Absolute pitch, integer values from MIDI table.

var app = {};
app.HOME_ROW = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "Enter"];
app.DEFAULT_KEYBOARD_MAP = {
    "q": 80,
    "w": 81,
    "e": 82,
    "r": 83,
    "t": 84,
    "y": 85,
    "u": 86,
    "i": 87,
    "o": 88,
    "p": 89,
    "a": 70,
    "s": 71,
    "d": 72,
    "f": 73,
    "g": 74,
    "h": 75,
    "j": 76,
    "k": 77,
    "l": 78,
    ";": 79,
    "z": 60,
    "x": 61,
    "c": 62,
    "v": 63,
    "b": 64,
    "n": 65,
    "m": 66,
    ",": 67,
    ".": 68,
    "/": 69,
};
app.TONES = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "E#": 5,
    "Fb": 4,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
    "B#": 12,
    "Cb": 11,
};
app.MIDDLE_OCTAVE = 5;
app.DEGREES_PER_OCTAVE = 7;
app.MODES = {
    ionian:     [2, 2, 1, 2, 2, 2, 1],
    dorian:     [2, 1, 2, 2, 2, 1, 2],
    phrygian:   [1, 2, 2, 2, 1, 2, 2],
    lydian:     [2, 2, 2, 1, 2, 2, 1],
    mixolydian: [2, 2, 1, 2, 2, 1, 2],
    aeolian:    [2, 1, 2, 2, 1, 2, 2],
    locrian:    [1, 2, 2, 1, 2, 2, 2],
};
app.SHARP_CHAR = '\u266F';
app.FLAT_CHAR = '\u266D';

app.verbose = false;
app.tonic = "C";
app.mode = "ionian";
app.octave = app.MIDDLE_OCTAVE;
app.transpose = false;
app.pool = [0, 1, 2, 3, 4];
app.kmap = app.DEFAULT_KEYBOARD_MAP;

app.magic = true;
app.treble = true;
app.bass = true;
app.frames_per_second = 120;
app.ticks_per_second = 60;
app.speed = 1.0;
app.target_color = "black";
app.edge = 0.1;
app.anvil = 0.14;
app.hammer = 0.16;
app.x_velocity = -0.10;
app.targets = [];
app.qdata = "";
app.queue = [];
app.qtime = 0;
app.score = 0;
app.badge = 0;
app.bonus = 0;
app.active_notes = [];
app.frame_counter = 0;

var wtf = {};
wtf.midi_access = null;
wtf.canvas = null;
wtf.context = null;
wtf.audio = null;
wtf.sound_generator = null;


////////////////////////////////////////////////////////////////
// midi
////////////////////////////////////////////////////////////////

function note2frequency(note) {
    return utils.ui32(440 * Math.pow(2, (note - 69) / 12));
}

function midiInputSetup() {
    var ok = false;
    var input = wtf.midi_access.inputs.values().next();
    while (input && !(input.done)) {
        input.value.onmidimessage = onMIDIMessage;
        input = input.next;
        ok = true;
    }
    if (!ok) {
        alert("MIDI input device not found.");
    }
}
function onMIDIAccept(midi) {
    wtf.midi_access = midi;
    wtf.midi_access.onstatechange = midiInputSetup;
    midiInputSetup();
    tick.cache = {};
    tick(tick.cache);
}
function onMIDIReject(err) {
    alert("MIDI system failed to start.");
}
function onMIDIMessage(evt) {
    var channel = evt.data[0] & 0xF;
    var type = evt.data[0] & 0xF0;
    if (type === 0x90) {
        var velocity = evt.data[2];
        var note = evt.data[1];
        if (velocity === 0) {
            noteOff(note);
            return;
        }
        else {
            noteOn(note);
            return;
        }
    }
    else if (type === 0x80) {
        var note = evt.data[1];
        noteOff(note);
        return;
    }
}

function noteOn(note) {
    if (utils.containsElement(app.active_notes, note)) {
        return;
    }
    app.active_notes.push(note);
    onInput(note);
}

function noteOff(note) {
    if (!utils.containsElement(app.active_notes, note)) {
        return;
    }
    var idx = app.active_notes.indexOf(note);
    if (idx > -1) {
        app.active_notes.splice(idx, 1);
    }
}

function midi2object(arr) {
    var index = 0;

    function ui32(arg) {
        return utils.ui32(arg);
    }

    function parseVariableLengthValue() {
        var value = 0;
        while (ui32(arr[index] & 0x80) > 0) {
            value = ui32(value << 7) + ui32(arr[index++] & 0x7F);
        }
        value = ui32(value << 7) + ui32(arr[index++] & 0x7F);
        utils.assert(value < ui32(0x10000000));
        return value;
    }

    function parseFile() {
        var header = {
            chunk_id: "",
            chunk_size: 0,
            chunk_offset: null,
            format_type: 0,
            number_of_tracks: 0,
            time_division: 0,
        };
        var tracks = [];
        header.chunk_id += String.fromCharCode(arr[index++]);
        header.chunk_id += String.fromCharCode(arr[index++]);
        header.chunk_id += String.fromCharCode(arr[index++]);
        header.chunk_id += String.fromCharCode(arr[index++]);
        utils.assert(header.chunk_id === "MThd");
        header.chunk_size += ui32(arr[index++] << 24);
        header.chunk_size += ui32(arr[index++] << 16);
        header.chunk_size += ui32(arr[index++] << 8);
        header.chunk_size += ui32(arr[index++] << 0);
        header.chunk_offset = index;
        header.format_type += ui32(arr[index++] << 8);
        header.format_type += ui32(arr[index++] << 0);
        header.number_of_tracks += ui32(arr[index++] << 8);
        header.number_of_tracks += ui32(arr[index++] << 0);
        header.time_division += ui32(arr[index++] << 8);
        header.time_division += ui32(arr[index++] << 0);
        for (var i = 0; i < header.number_of_tracks; i++) {
            tracks.push(parseTrack());
        }
        utils.assert(index === arr.length);
        return {header: header, tracks: tracks};
    }

    function parseTrack() {
        var header = {
            chunk_id: "",
            chunk_size: 0,
            chunk_offset: null,
        };
        var events = [];
        var buffer = null;
        header.chunk_id += String.fromCharCode(arr[index++]);
        header.chunk_id += String.fromCharCode(arr[index++]);
        header.chunk_id += String.fromCharCode(arr[index++]);
        header.chunk_id += String.fromCharCode(arr[index++]);
        header.chunk_size += ui32(arr[index++] << 24);
        header.chunk_size += ui32(arr[index++] << 16);
        header.chunk_size += ui32(arr[index++] << 8);
        header.chunk_size += ui32(arr[index++] << 0);
        header.chunk_offset = index;
        if (header.chunk_id === "MTrk") {
            while (index < header.chunk_offset + header.chunk_size) {
                buffer = parseEvents();
                for (var i = 0; i < buffer.length; i++) {
                    events.push(buffer[i]);
                }
            }
            utils.assert(index === header.chunk_offset + header.chunk_size);
        }
        else {
            index = header.chunk_offset + header.chunk_size;
        }
        return {header: header, events: events};
    }

    function parseEvents() {
        var events = [];
        var delta = parseVariableLengthValue();
        var type = ui32(arr[index++]);
        var parameters = null;
        utils.assert(-1 < type && type < 256);
        utils.assert(ui32(type & 0x80) > 0);
        if (ui32(type & 0xF0) === 0xF0) {
            parameters = [];
            if (type === 0xF0) {
                while (index < arr.length && arr[index] !== 0xF7) {
                    parameters.push(arr[index++]);
                }
                utils.assert(index < arr.length && arr[index] === 0xF7);
                parameters.push(arr[index++]);
            }
            else if (type === 0xF1) {
                parameters.push(arr[index++]);
            }
            else if (type === 0xF2) {
                parameters.push(arr[index++]);
                parameters.push(arr[index++]);
            }
            else if (type === 0xF3) {
                parameters.push(arr[index++]);
            }
            else if (type === 0xFF) {
                parameters.push(arr[index++]);
                parameters.push(arr[index++]);
                for (var i = 0; i < parameters[1]; i++) {
                    parameters.push(arr[index++]);
                }
            }
            events.push({
                delta: delta,
                type: type,
                parameters: parameters,
                hint: null,
                channel: null,
            });
        }
        else {
            // Running Status allows multiple events per status byte.
            // TODO: Verify that MIDI files don't use real-time messages.
            // Real-time messages should not terminate this loop! FIXME?
            while (true) {
                if (ui32(arr[index] & 0x80) > 0) {
                    break;
                }
                if (ui32(arr[index + 1] & 0x80) > 0) {
                    break;
                }
                parameters = [];
                if (ui32(type & 0xF0) === 0xC0) {
                    parameters.push(arr[index++]);
                }
                else if (ui32(type & 0xF0) === 0xD0) {
                    parameters.push(arr[index++]);
                }
                else {
                    parameters.push(arr[index++]);
                    parameters.push(arr[index++]);
                }
                events.push({
                    delta: delta,
                    type: type,
                    parameters: parameters,
                    hint: {
                        "0x80": "Note Off",
                        "0x90": "Note On",
                        "0xA0": "Polyphonic Key Pressure (Aftertouch)",
                        "0xB0": "Control Change",
                        "0xC0": "Program Change",
                        "0xD0": "Channel Pressure (Aftertouch)",
                        "0xE0": "Pitch Bend Change",
                    }["0x" + ui32(type & 0xF0).toString(16).toUpperCase()],
                    channel: ui32(type & 0x0F),
                });
            }
        }
        return events;
    }
    return parseFile();
}


////////////////////////////////////////////////////////////////
// misc
////////////////////////////////////////////////////////////////

function createScale(tonic, mode) {
    var scale = [app.TONES[tonic]];
    for (var i = 0; i < app.MODES[mode].length; i++) {
        var interval = app.MODES[mode][i];
        scale.push(scale[scale.length - 1] + interval);
    }
    return scale;
}

function createSoundGenerator(ctx) {
    var speakers = {};
    var rmbuffer = [];
    function produceSound(frequency, volume) {
        var now = wtf.audio_context.currentTime;
        var key = frequency.toString() + "hz";
        if (speakers.hasOwnProperty(key) && speakers[key] !== null) {
            return;
        }
        var onode = ctx.createOscillator();
        onode.frequency.value = frequency;
        onode.type = "sine";

        var gnode = ctx.createGain();
        gnode.gain.value = 0;

        onode.connect(gnode);
        gnode.connect(ctx.destination);

        speakers[key] = {onode: onode, gnode: gnode};
        speakers[key].onode.start();
        speakers[key].gnode.gain.setTargetAtTime(volume, now + 0.01, 0.01);
    }
    function destroySound(frequency) {
        var now = wtf.audio_context.currentTime;
        var key = frequency.toString() + "hz";
        if (speakers.hasOwnProperty(key) && speakers[key] !== null) {
            var speaker = speakers[key];
            speakers[key] = null;
            rmbuffer.push(speaker);
            speaker.gnode.gain.setTargetAtTime(0, now + 0.01, 0.01);
            setTimeout(function() {
                rmbuffer.shift().onode.stop();
            }, 100);
        }
    }
    function clear() {
        var keys = utils.keys(speakers);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var speaker = speakers[key];
            if (speaker !== null) {
                var frequency = speaker.onode.frequency.value;
                destroySound(frequency);
            }
        }
    }
    return {
        produceSound: produceSound,
        destroySound: destroySound,
        clear: clear,
        speakers: speakers,
        rmbuffer: rmbuffer,
    };
}

function createKeyboardMap(keys, scale, octave) {
    var kmap = {};
    var scale = scale.slice();
    for (var i = 0; i < scale.length; i++) {
        scale[i] = scale[i] + 12 * octave;
    }
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var dval = utils.div(i, app.DEGREES_PER_OCTAVE);
        var mval = utils.mod(i, app.DEGREES_PER_OCTAVE);
        kmap[key] = scale[mval] + 12 * dval;
    }
    return kmap;
}

function degree2note(scale, octave, degree) {
    var aval = 0;
    while (degree < 0) {
        degree += app.DEGREES_PER_OCTAVE;
        aval -= 12;
    }
    var bval = 12 * octave;
    var cval = 12 * utils.div(degree, app.DEGREES_PER_OCTAVE);
    var dval = scale[utils.mod(degree, app.DEGREES_PER_OCTAVE)];
    return aval + bval + cval + dval;
}

// Accidentals don't really translate to any single degree on a diatonic scale.
function note2degrees(scale, octave, note) {
    var aval = 0;
    while (note < (12 * octave) + scale[0]) {
        note += 12;
        aval -= app.DEGREES_PER_OCTAVE;
    }
    var bval = 0;
    while (degree2note(scale, octave, bval) < note) {
        bval += 1;
    }
    if (degree2note(scale, octave, bval) === note) {
        return [aval + bval];
    }
    else {
        return [aval + bval - 1, aval + bval];
    }
}

function drawText(ctx, txt, x, y, fColor, sColor, size) {
    ctx.font = "" + size.toString() + "pt Arial";
    ctx.strokeStyle = sColor;
    ctx.fillStyle = fColor;
    ctx.strokeText(txt, x, y);
    ctx.fillText(txt, x, y);
}

function drawLine(ctx, x1, y1, x2, y2, width, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
}

////////////////////////////////////////////////////////////////
// game
////////////////////////////////////////////////////////////////

function onInput(note) {
    if (app.verbose) {
        console.log("================");
        console.log("Note:" + note + " - " + note2frequency(note) + "hz");
    }
    for (var i = 0; i < app.targets.length; i++) {
        var target = app.targets[i];
        if (target.x > app.hammer) {
            break;
        }
        if (target.x < app.anvil || target.type !== "Note On") {
            continue;
        }
        var scale = createScale(app.tonic, app.mode);
        var expected = degree2note(scale, app.octave, target.degree);
        var observed = note;
        if (app.verbose) {
            console.log("Comparing notes...");
            console.log("Expected: " + expected);
            console.log("Observed: " + observed);
        }
        if (expected === observed) {
            app.targets.splice(i, 1);
            onRightNote();
        }
    }

    function onRightNote() {
        app.score += 1;
        app.score += app.bonus;
        app.bonus += 1;
        if (app.score > app.badge) {
            app.badge = app.score;
        }
    }
}

function tick() {
    var dt = app.speed * (1 / app.ticks_per_second);

    // Create targets.
    if (app.queue.length > 0) {
        app.qtime += dt;
        while (app.queue.length > 0 && app.queue[0].timestamp < app.qtime) {
            app.targets.push(app.queue.shift());
        }
    }

    // Process targets.
    for (var i = 0; i < app.targets.length; i++) {
        var target = app.targets[i];
        target.x += app.x_velocity * dt;
        if (target.x > app.anvil) {
            continue;
        }
        if (target.type === "Key Signature") {
            app.tonic = app.transpose ? app.tonic : target.tonic;
            app.mode = app.transpose ? app.mode : target.mode;
            app.targets.splice(i, 1);
        }
        else if (target.type === "Note On" || target.type === "Note Off") {
            app.octave = app.transpose ? app.octave : target.octave;
        }
    }

    // Magic.
    if (app.magic) {
        while (app.targets.length > 0 && app.targets[0].x < app.anvil) {
            var target = app.targets.shift();
            var scale = createScale(app.tonic, app.mode);
            var note = degree2note(scale, app.octave, target.degree);
            var frequency = note2frequency(note);
            if (target.type === "Note On") {
                wtf.sound_generator.produceSound(frequency, 0.25);
            }
            else if (target.type === "Note Off") {
                wtf.sound_generator.destroySound(frequency);
            }
        }
    }

    // Destroy targets.
    while (app.targets.length > 0 && app.targets[0].x < app.edge) {
        app.targets.shift();
    }

    // Update canvas.
    if (app.frame_counter > 1 / app.frames_per_second) {
        draw();
        app.frame_counter = 0;
    }
    app.frame_counter += dt;
    setTimeout(function() {
        tick();
    }, 1000 / app.ticks_per_second);

}

function draw() {
    var cvs = wtf.canvas;
    var ctx = cvs.getContext("2d");
    var xmin = 0;
    var ymin = 0;
    var xmax = cvs.width;
    var ymax = cvs.height;
    var target_width = 0.01;
    var target_height = 0.05;

    drawLines();
    drawTargets();
    drawBoundaries();
    drawKeySignature();
    drawInfo();

    function drawLines() {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, cvs.width, cvs.height);

        // border
        drawLine(ctx, xmin, ymin, xmin, ymax, 1, "black");
        drawLine(ctx, xmin, ymin, xmax, ymin, 1, "black");
        drawLine(ctx, xmax, ymin, xmax, ymax, 1, "black");
        drawLine(ctx, xmin, ymax, xmax, ymax, 1, "black");

        // guides
        for (var yprop = 0.1; yprop < 1; yprop += target_height) {
            drawLine(ctx, 0, yprop * ymax, xmax, yprop * ymax, 1, "lightGray");
        }

        // staff one
        if (app.treble) {
            for (var i = 0; i < 5; i++) {
                var yprop = target_height * i + 0.25;
                drawLine(ctx, 0, yprop * ymax, xmax, yprop * ymax, 2, "gray");
            }
        }

        // staff two
        if (app.bass) {
            for (var i = 0; i < 5; i++) {
                var yprop = target_height * i + 0.55;
                drawLine(ctx, 0, yprop * ymax, xmax, yprop * ymax, 2, "gray");
            }
        }
    }

    function drawBoundaries() {
        var xval = app.edge * xmax;
        drawLine(ctx, xval, ymin, xval, ymax, target_width * xmax, "black");

        utils.assert(app.anvil < app.hammer);
        if (app.hammer - app.anvil !== target_width) {
            utils.assert(app.hammer - app.anvil > target_width);
        }
        xval = (app.anvil + target_width / 2) * xmax;
        drawLine(ctx, xval, ymin, xval, ymax, 1, "black");
        xval = (app.hammer - target_width / 2) * xmax;
        drawLine(ctx, xval, ymin, xval, ymax, 1, "black");
    }

    function drawTargets() {
        for (var i = 0; i < app.targets.length; i++) {
            var target = app.targets[i];
            drawTarget(target, target.x, target2yprop(target));
        }
        function target2yprop(target) {
            var dlut = {"C": 0, "D": 1, "E": 2, "F": 3, "G": 4, "A": 5, "B": 6};
            var ds = 0;
            ds += app.DEGREES_PER_OCTAVE * (app.octave - app.MIDDLE_OCTAVE);
            ds += dlut[app.tonic[0]];
            ds += target.degree;
            if (target.accidental !== 0) {
                ds += target.accidental * 0.5;
            }
            return 0.5 - (ds * target_height / 2);
        }
        function drawTarget(target, xprop, yprop) {
            var wval = target_width * xmax;
            var hval = target_height * ymax;
            if (target.accidental !== 0) {
                hval /= 2;
            }
            var xval = (xprop * xmax) - (wval / 2);
            var yval = (yprop * ymax) - (hval / 2);

            ctx.beginPath();
            ctx.fillStyle = "black";
            ctx.strokeStyle = "black";
            if (target.type === "Note On") {
                utils.assert(-2 < target.accidental && target.accidental < 2);
                ctx.rect(xval, yval, wval, hval);
            }
            else if (target.type === "Key Signature") {
                drawLine(ctx, xval, 0, xval, ymax);
            }
            ctx.fill();
            ctx.stroke();
            ctx.closePath();

            if (target.type === "Note On") {
                yval += (hval / 2);
                drawLine(ctx, xval, yval, xval + wval, yval, 3, "white");
            }
        }
    }


    /*\
    var xlut = {
        flats: [0.06, 0.04, 0.02, 0.07, 0.05, 0.03, 0.01],
        sharps: [0.02, 0.04, 0.06, 0.01, 0.03, 0.05, 0.07],
    };
    var ylut = {
        flats: [0.325, 0.3, 0.275, 0.425, 0.4, 0.375, 0.35],
        sharps: [0.325, 0.3, 0.275, 0.25, 0.225, 0.375, 0.35],
    };
    \*/
    function drawKeySignature() {
        var wlut = {
            "C": "ionian",
            "D": "dorian",
            "E": "phrygian",
            "F": "lydian",
            "G": "mixolydian",
            "A": "aeolian",
            "B": "locrian",
        };
        var xlut = {
            "F#": 0,
            "C#": 1,
            "G#": 2,
            "D#": 3,
            "A#": 4,
            "E#": 5,
            "B#": 6,
            "Bb": 0,
            "Eb": 1,
            "Ab": 2,
            "Db": 3,
            "Gb": 4,
            "Cb": 5,
            "Fb": 6,
        };
        var ylut = {
            "A#": 5,
            "B#": 6,
            "C#": 7,
            "D#": 8,
            "E#": 9,
            "F#": 10,
            "G#": 11,
            "Ab": 5,
            "Bb": 6,
            "Cb": 7,
            "Db": 8,
            "Eb": 9,
            "Fb": 3,
            "Gb": 4,
        };
        var scale = createScale(app.tonic, app.mode);
        var white = createScale(app.tonic[0], wlut[app.tonic[0]]);
        var arr = ["C", "D", "E", "F", "G", "A", "B"];
        var sig = {};
        for (var i = 0; i < white.length - 1; i++) {
            var idx = utils.mod(arr.indexOf(app.tonic[0]) + i, arr.length);
            var key = arr[idx];
            var expected = degree2note(white, app.MIDDLE_OCTAVE, i);
            var observed = degree2note(scale, app.MIDDLE_OCTAVE, i);
            if (app.tonic === "Cb") {
                expected = degree2note(white, app.MIDDLE_OCTAVE + 1, i);
            }
            if (expected !== observed) {
                var atom = observed < expected ? "b" : "#";
                var symbol = "";
                for (var j = 0; j < Math.abs(observed - expected); j++) {
                    symbol += atom;
                }
                sig[key] = {
                    x: xlut[key + atom],
                    y: ylut[key + atom],
                    z: symbol,
                }
            }
        }

        var keys = utils.keys(sig);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var xprop = 0.01 + sig[key].x * 0.01;
            var yprop = 0.5 - sig[key].y * 0.025;
            var xval = xprop * xmax;
            var yval = yprop * ymax + 8;
            var symbol = sig[key].z;
            symbol = symbol.replace(/[#]/g, app.SHARP_CHAR);
            symbol = symbol.replace(/[b]/g, app.FLAT_CHAR);
            drawText(ctx, symbol, xval, yval, "black", "black", 16);
        }
    }

    function drawInfo() {
        var xval = 0.025 * xmax;
        var yval = 0;

        yval += 0.025 * ymax;
        drawText(ctx, "Score: " + app.score, xval, yval, "black", "white", 8);
        yval += 0.025 * ymax;
        drawText(ctx, "Badge: " + app.badge, xval, yval, "black", "white", 8);
        yval += 0.025 * ymax;
        drawText(ctx, "Bonus: " + app.bonus, xval, yval, "black", "white", 8);
    }
}

////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////

function main(argv) {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    wtf.canvas = document.getElementById("canvas");
    wtf.audio_context = new AudioContext();
    wtf.sound_generator = createSoundGenerator(wtf.audio_context);
    utils.update(app, utils.uri2data(window.location.href, []));
    window.addEventListener('load', function() {
        if (wtf.context === null) {
            wtf.context = new AudioContext();
            if (navigator.requestMIDIAccess) {
                navigator.requestMIDIAccess().then(onMIDIAccept, onMIDIReject);
            }
            else {
                alert("Sorry, this page probably won't work in your browser.");
            }
        }
    });
    document.onkeydown = function(evt) {
        var keyid = utils.keyEventSourceId(evt);
        var note = app.kmap[keyid];
        noteOn(note);
    };
    document.onkeyup = function(evt) {
        var keyid = utils.keyEventSourceId(evt);
        var note = app.kmap[keyid];
        wtf.sound_generator.destroySound(note2frequency(note));
        noteOff(note);
    };
    document.getElementById("fsrc").onchange = function(evt) {
        var reader = new FileReader();
        reader.onload = function(evt) {
            app.qdata = utils.ab2base64str(evt.target.result);
        };
        reader.readAsArrayBuffer(evt.target.files[0]);
    };
    document.getElementById("ibtn").onclick = function() {
        if (app.qdata === "") {
            alert("Please choose a MIDI file.");
            return;
        }
        var scale = createScale(app.tonic, app.mode);
        var buf = utils.base64str2ab(app.qdata);
        var src = new Uint8Array(buf);
        app.queue.length = 0;
        app.targets.length = 0;
        app.qtime = 0.0;
        app.score = 0;
        app.bonus = 0;
        wtf.sound_generator.clear();
        buildQueue(midi2object(src));
    }

    function buildQueue(midi) {
        var timeline = createTimeline(midi);
        var scale = createScale(app.tonic, app.mode);
        for (var i = 0; i < timeline.length; i++) {
            var evt = timeline[i];
            var targets = createTargets(evt, scale);
            for (var j = 0; j < targets.length; j++) {
                var target = targets[j];
                if (target.type === "Key Signature") {
                    scale = createScale(target.tonic, target.mode);
                }
                app.queue.push(target);
            }
        }
    }

    function createTimeline(midi) {
        var arr = [];

        var interpreter = null;
        if ((midi.header.time_division & 0x8000) === 0) {
            interpreter = {
                type: 0,
                ticks_per_beat: midi.header.time_division,
                beats_per_second: 2, // 120 beats per minute is the default.
                ticks2seconds: function(ts) {
                    return ts / (this.ticks_per_beat * this.beats_per_second);
                },
            };
        }
        else {
            interpreter = {
                type: 1,
                ticks_per_frame: midi.header.time_division & 0x00FF,
                frames_per_second: midi.header.time_division & 0x7F00,
                ticks2seconds: function(ts) {
                    return ts / (this.ticks_per_frame * this.frames_per_second);
                },
            };
            if (interpreter.frames_per_second === 29) {
                interpreter.frames_per_second = 29.97; // By definition.
            }
        }

        var tvals = [];
        var ivals = [];
        for (var i = 0; i < midi.tracks.length; i++) {
            tvals.push(0);
            ivals.push(0);
        }
        var candidates = [];
        function tryAddNextCandidateFrom(idx) {
            var track = midi.tracks[idx];
            var events = track.events;
            if (ivals[idx] < events.length) {
                var evt = events[ivals[idx]++];
                tvals[idx] += interpreter.ticks2seconds(evt.delta);
                candidates.push({track_idx: idx, time: tvals[idx], evt: evt});
                utils.insertionSort(candidates, function(lhs, rhs) {
                    return lhs.time - rhs.time;
                });
            }
        }

        for (var i = 0; i < midi.tracks.length; i++) {
            tryAddNextCandidateFrom(i);
        }
        while (candidates.length > 0) {
            var val = candidates.shift();
            var evt = val.evt;
            arr.push({
                timestamp: val.time,
                type: evt.type,
                parameters: evt.parameters,
                hint: evt.hint,
                target_channel: evt.channel,
                source_track: val.track_idx,
            });
            if (evt.type === 0xFF && evt.parameters[0] === 0x51) {
                var seconds_per_micro = 0.000001
                var micros_per_beat = 0.0;
                var seconds_per_beat = null;
                for (var i = 0; i < evt.parameters[1]; i++) {
                    micros_per_beat = utils.ui32(micros_per_beat << 8);
                    micros_per_beat += evt.parameters[2 + i];
                }
                seconds_per_beat = seconds_per_micro * micros_per_beat;
                interpreter.beats_per_second = (1.0 / seconds_per_beat);
            }
            tryAddNextCandidateFrom(val.track_idx);
        }

        // The array should be sorted already, so in theory this is fast.
        utils.insertionSort(arr, function(lhs, rhs) {
            return lhs.timestamp - rhs.timestamp;
        });
        return arr;
    }

    function createTargets(evt, scale) {
        if (evt.type === 0xFF && evt.parameters[0] === 0x59) {
            var smajor = ["C", "G", "D", "A", "E", "B", "F#", "C#"];
            var fmajor = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C"];
            var sminor = ["A", "E", "B", "F#", "C#", "G#", "D#", "A#"];
            var fminor = ["Ab", "Eb", "Bb", "F", "C", "G", "D", "A"];
            var mval = evt.parameters[3];
            var tval = evt.parameters[2];
            utils.assert(evt.parameters[1] === 2);
            utils.assert(mval === 0 || mval === 1);
            var tonic, mode;
            if (mval === 0) {
                mode = "ionian";
                tonic = tval & 0x80 ? fmajor[(tval + 7) & 0xFF] : smajor[tval];
            }
            else if (mval === 1) {
                mode = "aeolian";
                tonic = tval & 0x80 ? fminor[(tval + 7) & 0xFF] : sminor[tval];
            }
            return [{
                timestamp: evt.timestamp,
                type: "Key Signature",
                mode: mode,
                tonic: tonic,
                x: 1,
            }];
        }
        if (evt.hint !== "Note On" && evt.hint !== "Note Off") {
            return [];
        }
        var note = evt.parameters[0];
        var velocity = evt.parameters[1];
        var octave = app.MIDDLE_OCTAVE;
        var degrees = note2degrees(scale, octave, note);
        var targets = [];
        for (var i = 0; i < degrees.length; i++) {
            var degree = degrees[i];
            var accidental = note - degree2note(scale, octave, degree);
            targets.push({
                timestamp: evt.timestamp,
                type: (velocity === 0 ? "Note Off" : evt.hint),
                degree: degree,
                accidental: accidental,
                octave: octave,
                x: 1,
            });
        }
        return targets;
    }
}