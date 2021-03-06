/*
    midi.js - Simple game for learning to play music on electronic keyboards.
    Copyright (C) 2016 Douglas Cantrell <cantrell.douglas@gmail.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

"use strict";

// Degree: Index into a scale.
// Tone: Relative pitch, integer number of semitones.
// Note: Absolute pitch, integer values from MIDI table.

var app = {};
app.HOME_ROW = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "Enter"];
app.KEYSIGX = 0.01;
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
app.quiet = true;
app.debug = false;
app.echo = true;
app.hack = false;
app.tonic = "C";
app.mode = "ionian";
app.octave = app.MIDDLE_OCTAVE;
app.transpose = false;
app.colors = ["DarkRed", "DarkGreen", "DarkBlue"];
app.filters = [];
app.kmap = keymap();

app.magic = false;
app.treble = true;
app.bass = true;
app.ticks_per_second = 120;
app.ticks_per_frame = 1;
app.speed = 1.0;
app.edge = 0.1;
app.anvil = 0.15;
app.hammer = 0.16;
app.x_velocity = -0.10;
app.targets = [];
app.qdata = greensleeves();
app.qmeta = {tonic: "C", mode: "ionian"};
app.queue = [];
app.qhead = 0;
app.qtime = 0;
app.score = 0;
app.badge = 0;
app.combo = 0;
app.active_notes = [];
app.tick_counter = 0;

var evil = {};
evil.midi_access = null;
evil.canvas = null;
evil.context = null;
evil.audio = null;
evil.sound_generator = null;
evil.patch = function(dt) {
    if (!app.hack) {
        return;
    }
    var ts = app.targets;
    var ref = "Note On";
    var i = 0;
    while (i < ts.length && (ts[i].x <= app.anvil || ts[i].type !== ref)) {
        i += 1;
    }
    if (i < ts.length) {
        app.hammer = ts[i].x + 0.01;
    }
};


////////////////////////////////////////////////////////////////
// midi
////////////////////////////////////////////////////////////////

function note2frequency(note) {
    return utils.ui32(440 * Math.pow(2, (note - 69) / 12));
}

function midiInputSetup() {
    var ok = false;
    var input = evil.midi_access.inputs.values().next();
    while (input && !(input.done)) {
        input.value.onmidimessage = onMIDIMessage;
        input = input.next;
        ok = true;
    }
    if (!ok) {
        console.log("MIDI input device not found.");
    }
}
function onMIDIAccept(midi) {
    evil.midi_access = midi;
    evil.midi_access.onstatechange = midiInputSetup;
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
        var now = ctx.currentTime;
        var key = frequency.toString() + "hz";
        if (speakers.hasOwnProperty(key) && speakers[key] !== null) {
            return;
        }
        var onode = ctx.createOscillator();
        onode.type = "sine";
        onode.frequency.setValueAtTime(frequency, now);

        var gnode = ctx.createGain();
        gnode.gain.setValueAtTime(0, now);

        onode.connect(gnode);
        gnode.connect(ctx.destination);

        speakers[key] = {onode: onode, gnode: gnode};
        speakers[key].onode.start();
        speakers[key].gnode.gain.setTargetAtTime(volume, now + 0.01, 0.01);
    }
    function destroySound(frequency) {
        var now = ctx.currentTime;
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
    ctx.beginPath(); // TODO: Delete this?
    ctx.font = "" + size.toString() + "pt monospace";
    ctx.strokeStyle = sColor;
    ctx.fillStyle = fColor;
    ctx.lineWidth = 2; // TODO: Delete this?
    ctx.strokeText(txt, x, y);
    ctx.fillText(txt, x, y);
    ctx.closePath(); // TODO: Delete this?
}

function drawLine(ctx, x1, y1, x2, y2, width, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.fillStyle = color; // TODO: Delete this?
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
}

////////////////////////////////////////////////////////////////
// game
////////////////////////////////////////////////////////////////

function note2desc(note) {
    var arr = ["C", "CD", "D", "DE", "E", "F", "FG", "G", "GA", "A", "AB", "B"];
    var name = arr[utils.mod(note, arr.length)];
    var frequency = note2frequency(note).toString() + "hz";
    return ["Note:", note.toString(), name, frequency].join("\t");
}

function onInput(note) {
    if (app.verbose) {
        console.log("================");
        console.log(note2desc(note));
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
        app.combo += 1;
        if (app.combo > app.badge) {
            app.badge = app.combo;
        }
    }
}

function createTargets(evt, tonic, mode) {
    if (evt.type === 0xFF && evt.parameters[0] === 0x59) {
        var smajor = ["C", "G", "D", "A", "E", "B", "F#", "C#"];
        var fmajor = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C"];
        var sminor = ["A", "E", "B", "F#", "C#", "G#", "D#", "A#"];
        var fminor = ["Ab", "Eb", "Bb", "F", "C", "G", "D", "A"];
        var traw = evt.parameters[2];
        var mraw = evt.parameters[3];
        var tval = null;
        var mval = null;
        utils.assert(evt.parameters[1] === 2);
        utils.assert(mraw === 0 || mraw === 1);
        if (mraw === 0) {
            tval = traw & 0x80 ? fmajor[(traw + 7) & 0xFF] : smajor[traw];
            mval = "ionian";
        }
        else if (mraw === 1) {
            tval = traw & 0x80 ? fminor[(traw + 7) & 0xFF] : sminor[traw];
            mval = "aeolian";
        }
        return [{
            type: "Meta: Key Signature",
            track: evt.src_track,
            tonic: tval,
            mode: mval,
            x: 1 + (app.qtime - evt.timestamp) * app.x_velocity,
        }];
    }
    if (evt.hint !== "Note On" && evt.hint !== "Note Off") {
        return [];
    }
    var note = evt.parameters[0];
    var velocity = evt.parameters[1];
    var scale = createScale(tonic, mode);
    var octave = app.MIDDLE_OCTAVE;
    var degrees = note2degrees(scale, octave, note);
    var targets = [];
    for (var i = 0; i < degrees.length; i++) {
        var degree = degrees[i];
        var accidental = note - degree2note(scale, octave, degree);
        targets.push({
            type: (velocity === 0 ? "Note Off" : evt.hint),
            track: evt.src_track,
            degree: degree,
            accidental: accidental,
            x: 1 + (app.qtime - evt.timestamp) * app.x_velocity,
        });
    }
    return targets;
}

function tick() {
    var dt = (app.speed > 0 ? app.speed : 0) * (1 / app.ticks_per_second);

    // TODO: This is kind of an ugly hack.
    if (app.speed < 0) {
        var counter = app.speed;
        var dt = 0;
        for (var i = 0; i < app.targets.length; i++) {
            if (app.targets[i].type === "Note On") {
                counter += 1;
            }
        }
        for (var i = app.qhead; i < app.queue.length; i++) {
            if (counter < 0) {
                dt = app.queue[i].timestamp - app.qtime + 0.001;
                if (
                    true
                    && app.queue[i].hint === "Note On"
                    && app.queue[i].parameters[1] !== 0
                ) {
                    counter += 1;
                }
            }
            else {
                break;
            }
        }
    }

    // Process targets.
    for (var i = 0; i < app.targets.length; i++) {
        var target = app.targets[i];
        target.x += app.x_velocity * dt;
        if (target.x > app.hammer) {
            continue;
        }
        if (target.type === "Meta: Key Signature") {
            app.tonic = app.transpose ? app.tonic : target.tonic;
            app.mode = app.transpose ? app.mode : target.mode;
            app.targets.splice(i, 1);
            evil.sound_generator.clear();
        }
    }

    // Create targets.
    if (app.qhead < app.queue.length) {
        app.qtime += dt;
    }
    while (
        true
        && app.qhead < app.queue.length
        && app.queue[app.qhead].timestamp < app.qtime
    ) {
        var evt = app.queue[app.qhead];
        app.qhead += 1;

        var targets = createTargets(evt, app.qmeta.tonic, app.qmeta.mode);
        for (var i = 0; i < targets.length; i++) {
            var target = targets[i];
            if (!utils.containsElement(app.filters, target.track)) {
                app.targets.push(target);
                // TODO: Should key signatures really be filtered?
                if (target.type === "Meta: Key Signature") {
                    app.qmeta.tonic = target.tonic;
                    app.qmeta.mode = target.mode;
                }
            }
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
                evil.sound_generator.produceSound(frequency, 0.25);
            }
            else if (target.type === "Note Off") {
                evil.sound_generator.destroySound(frequency);
            }
        }
    }

    // Destroy targets.
    while (app.targets.length > 0 && app.targets[0].x < app.edge) {
        app.targets.shift();
        app.combo = 0;
    }

    // Callback.
    if (evil.patch !== null) {
        evil.patch(dt);
    }

    // Update canvas.
    app.tick_counter += 1;
    if (app.tick_counter % app.ticks_per_frame === 0) {
        draw();
        app.tick_counter = 0;
    }

    // Schedule next tick.
    setTimeout(function() {
        tick();
    }, 1000 / app.ticks_per_second);

}

function draw() {
    var cvs = evil.canvas;
    var ctx = cvs.getContext("2d");
    var xmin = 0;
    var ymin = 0;
    var xmax = cvs.width;
    var ymax = cvs.height;
    var target_width = 0.01;
    var target_height = 0.05;

    drawLines();
    drawKeySignature(app.tonic, app.mode, app.KEYSIGX);
    drawTargets();
    drawBoundaries();
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
        drawLine(ctx, xval, ymin, xval, ymax, 1, "black");

        utils.assert(app.anvil < app.hammer);
        xval = app.anvil * xmax;
        drawLine(ctx, xval, ymin, xval, ymax, 1, "black");
        xval = app.hammer * xmax;
        drawLine(ctx, xval, ymin, xval, ymax, 1, "black");
    }

    function drawTargets() {
        var tonic = app.tonic;
        var mode = app.mode;
        for (var i = 0; i < app.targets.length; i++) {
            var target = app.targets[i];
            if (target.type === "Meta: Key Signature" && !app.transpose) {
                tonic = target.tonic;
                mode = target.mode;
            }
            drawTarget(target);
        }
        function target2yprop(target) {
            var dlut = {"C": 0, "D": 1, "E": 2, "F": 3, "G": 4, "A": 5, "B": 6};
            var ds = 0;
            ds += app.DEGREES_PER_OCTAVE * (app.octave - app.MIDDLE_OCTAVE);
            ds += dlut[tonic[0]];
            ds += target.degree;
            if (target.accidental !== 0) {
                ds += target.accidental * 0.5;
            }
            return 0.5 - (ds * target_height / 2);
        }
        function drawTarget(target) {
            var xprop = target.x;
            var yprop = target2yprop(target);
            var wval = target_width * xmax;
            var hval = target_height * ymax;
            if (target.accidental !== 0) {
                hval /= 2;
            }
            hval /= 3; // TODO: Rename target_height to something else.
            var xval = (xprop * xmax);
            var yval = (yprop * ymax) - (hval / 2);
            var color = app.colors[utils.mod(target.track, app.colors.length)];

            var scale = createScale(tonic, mode);
            var note = degree2note(scale, app.octave, target.degree);
            if (target.type === "Note On") {
                ctx.beginPath();
                if (app.echo && utils.containsElement(app.active_notes, note)) {
                    ctx.fillStyle = "Black";
                }
                else {
                    ctx.fillStyle = "White";
                }
                if (utils.containsElement(app.filters, target.track)) {
                    ctx.strokeStyle = "White";
                }
                else {
                    ctx.strokeStyle = color;
                }
                ctx.lineWidth = 2;
                utils.assert(-2 < target.accidental && target.accidental < 2);
                ctx.rect(xval, yval, wval, hval);
                ctx.fill();
                ctx.stroke();
                ctx.closePath();
            }
            else if (target.type === "Meta: Key Signature") {
                var xyzzy = app.hammer - app.KEYSIGX;
                drawLine(ctx, xval, 0, xval, ymax);
                drawKeySignature(target.tonic, target.mode, target.x - xyzzy);
            }

            if (app.debug) {
                xval = target.x * xmax;
                if (target.type === "Note On") {
                    drawLine(ctx, xval, ymin, xval, ymax, 1, "red");
                }
                else if (target.type === "Note Off") {
                    drawLine(ctx, xval, ymin, xval, ymax, 1, "green");
                }
                else {
                    drawLine(ctx, xval, ymin, xval, ymax, 1, "blue");
                }
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
    function drawKeySignature(tonic, mode, xroot) {
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
        var scale = createScale(tonic, mode);
        var white = createScale(tonic[0], wlut[tonic[0]]);
        var arr = ["C", "D", "E", "F", "G", "A", "B"];
        var sig = {};
        for (var i = 0; i < white.length - 1; i++) {
            var idx = utils.mod(arr.indexOf(tonic[0]) + i, arr.length);
            var key = arr[idx];
            var expected = degree2note(white, app.MIDDLE_OCTAVE, i);
            var observed = degree2note(scale, app.MIDDLE_OCTAVE, i);
            if (tonic === "Cb") {
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
            var xprop = xroot + sig[key].x * 0.01;
            var yprop = 0.5 - sig[key].y * 0.025;
            var xval = xprop * xmax;
            var yval = yprop * ymax + 8;
            var symbol = sig[key].z;
            symbol = symbol.replace(/[#]/g, app.SHARP_CHAR);
            symbol = symbol.replace(/[b]/g, app.FLAT_CHAR);
            drawText(ctx, symbol, xval, yval, "black", "black", 16);
            yval += 0.35 * ymax;
            drawText(ctx, symbol, xval, yval, "black", "black", 16);
        }
    }

    function drawInfo() {
        var xval = 0.025 * xmax;
        var yval = 0;

        yval += 0.025 * ymax;
        drawText(ctx, "Score: " + app.score, xval, yval, "black", "white", 8);
        yval += 0.025 * ymax;
        drawText(ctx, "Combo: " + app.combo, xval, yval, "black", "white", 8);
        yval += 0.025 * ymax;
        drawText(ctx, "Badge: " + app.badge, xval, yval, "black", "white", 8);
    }
}

////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////

function main(argv) {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    evil.canvas = document.getElementById("canvas");
    evil.audio_context = new AudioContext();
    evil.sound_generator = createSoundGenerator(evil.audio_context);
    utils.update(app, utils.uri2data(window.location.href, []));
    window.addEventListener('load', function() {
        if (evil.context === null) {
            evil.context = new AudioContext();
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
        if (app.kmap.hasOwnProperty(keyid)) {
            var note = app.kmap[keyid];
            var frequency = note2frequency(note);
            if (!app.quiet) {
                evil.sound_generator.produceSound(frequency, 0.25);
            }
            noteOn(note);
        }
    };
    document.onkeyup = function(evt) {
        var keyid = utils.keyEventSourceId(evt);
        if (app.kmap.hasOwnProperty(keyid)) {
            var note = app.kmap[keyid];
            var frequency = note2frequency(note);
            evil.sound_generator.destroySound(frequency);
            noteOff(note);
        }
    };
    var pnames = Object.getOwnPropertyNames(app);
    pnames.sort();
    for (var i = 0; i < pnames.length; i++) {
        document.getElementById("psel").add((function() {
            var pname = pnames[i];
            var opt = document.createElement("option");
            opt.value = pname;
            opt.text = pname;
            return opt;
        })(), null);
    }
    document.getElementById("psel").onchange = function() {
        document.getElementById("ptxt").value = JSON.stringify(app[this.value]);
    }
    document.getElementById("pbtn").onclick = function() {
        var sel = document.getElementById("psel");
        try {
            app[sel.value] = JSON.parse(document.getElementById("ptxt").value);
        }
        catch (err) {
            alert("Error: Invalid JSON.");
        }
    }
    document.getElementById("fsrc").onchange = function(evt) {
        var reader = new FileReader();
        reader.onload = function(evt) {
            app.qdata = utils.ab2base64str(evt.target.result);
        };
        if (evt.target.files.length > 0) {
            reader.readAsArrayBuffer(evt.target.files[0]);
        }
    };
    document.getElementById("ibtn").onclick = function() {
        if (app.qdata === "") {
            alert("Please choose a MIDI file.");
            return;
        }
        var buf = utils.base64str2ab(app.qdata);
        var src = new Uint8Array(buf);
        app.queue.length = 0;
        app.targets.length = 0;
        app.qhead = 0;
        app.qtime = 0.0;
        app.score = 0;
        app.combo = 0;
        evil.sound_generator.clear();
        app.queue = createTimeline(alumidium.midi2object(src, utils.assert));
    }

    function createTimeline(midi) {
        // Q: Timeline?
        // A: A single list that contains all events in chronological order.
        var timeline = [];

        // Q: Interpreter?
        // A: MIDI files are weird.
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

        // Q: What does tvals do?
        // A: Each element of tvals tells you the timestamp of the event that
        // was most recently added to the candidate list from the track that
        // shares an index with that element.
        // Q: Okay, what about ivals?
        // A: Each element of ivals tells you the index of the next event that
        // should be added to the candidate list from the track that shares an
        // index with that element, if any, or the track length, otherwise.
        var tvals = [];
        var ivals = [];
        for (var i = 0; i < midi.tracks.length; i++) {
            tvals.push(0);
            ivals.push(0);
        }

        // Q: What is this?
        // A: This variable, candidates, is meant to hold one event from each
        // track. The event with the lowest timestamp can then be pulled out,
        // and replaced with the next event from the associated track, if any.
        // Don't assume that the index of the candidate matches the index of
        // the track; that was not true at the time this comment was written.
        var candidates = [];
        function tryAddNextCandidateFrom(idx) {
            var track = midi.tracks[idx];
            var events = track.events;
            if (ivals[idx] < events.length) {
                var evt = events[ivals[idx]++];
                tvals[idx] += interpreter.ticks2seconds(evt.delta);
                candidates.push({
                    evt: evt,
                    timestamp: tvals[idx],
                    track_idx: idx,
                });
                utils.insertionSort(candidates, function(lhs, rhs) {
                    return lhs.timestamp - rhs.timestamp;
                });
            }
        }
        for (var i = 0; i < midi.tracks.length; i++) {
            tryAddNextCandidateFrom(i);
        }

        function e2einfo(evt) {
            if (utils.ui32(evt.type & 0xF0) === 0xF0) {
                var hint = {
                    "0x0": "???",
                    "0x1": "???",
                    "0x2": "???",
                    "0x3": "???",
                    "0x4": "???",
                    "0x5": "???",
                    "0x6": "???",
                    "0x7": "???",
                    "0x8": "???",
                    "0x9": "???",
                    "0xa": "???",
                    "0xb": "???",
                    "0xc": "???",
                    "0xd": "???",
                    "0xe": "???",
                    "0xf": "Meta: " + {
                        "0x0": "Sequence Number",
                        "0x1": "General Text",
                        "0x2": "Copyright Text",
                        "0x3": "Sequence Name / Track Name",
                        "0x4": "Instrument Name",
                        "0x5": "Lyric Text",
                        "0x6": "Marker Text",
                        "0x7": "Cue Point Text",
                        "0x8": "Program Name",
                        "0x9": "Device Name",
                        "0x20": "Channel Prefix",
                        "0x21": "Port",
                        "0x2f": "End of Track",
                        "0x51": "Tempo",
                        "0x54": "SMPTE Offset",
                        "0x58": "Time Signature",
                        "0x59": "Key Signature",
                        "0x7f": "Sequencer Specific Event",
                    }["0x" + evt.parameters[0].toString(16)],
                }["0x" + utils.ui32(evt.type & 0x0F).toString(16)];
                var channel = null; // TODO: Should this really be null?
                return {hint: hint, channel: channel};
            }
            else {
                var hint =  {
                    "0x80": "Note Off",
                    "0x90": "Note On",
                    "0xa0": "Polyphonic Key Pressure (Aftertouch)",
                    "0xb0": "Control Change",
                    "0xc0": "Program Change",
                    "0xd0": "Channel Pressure (Aftertouch)",
                    "0xe0": "Pitch Bend Change",
                }["0x" + utils.ui32(evt.type & 0xF0).toString(16)];
                var channel = utils.ui32(evt.type & 0x0F);
                return {hint: hint, channel: channel};
            }
        }

        while (candidates.length > 0) {
            var val = candidates.shift();
            var evt = val.evt;
            timeline.push({
                timestamp: val.timestamp,
                hint: e2einfo(evt).hint,
                parameters: evt.parameters,
                src_track: val.track_idx,
                target_channel: e2einfo(evt).channel,
                type: evt.type,
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

        return timeline;
    }

}

function keymap() {
    var kmap = {};
    var keys = "";
    keys += "ZXCVBNM<>?ASDFGHJKL:QWERTYUIOP!@#$%^&*()";
    keys += "zxcvbnm,./asdfghjkl;qwertyuiop1234567890";
    for (var i = 0; i < keys.length; i++) {
        kmap[keys[i]] = i + 20;
    }
    return kmap;
}

function greensleeves() {
    return "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";
}
