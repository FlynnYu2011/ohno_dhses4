const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(process.argv[2] || 'dhses4.html', 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const flush = () => new Promise(resolve => setImmediate(resolve));

// Asynchronous browser API doubles: no microphone, user files or network are used.
function localDatabase() {
    const stores = new Map();
    const state = { failWrites: false, stores };
    const db = {
        objectStoreNames: { contains: name => stores.has(name) },
        createObjectStore(name) { stores.set(name, new Map()); },
        transaction(name) {
            const tx = {};
            const map = stores.get(name);
            function request(action, write = false) {
                const result = {};
                queueMicrotask(() => {
                    if (write && state.failWrites) { tx.error = Error('Storage full'); tx.onerror?.(); return; }
                    result.result = action(); result.onsuccess?.();
                    queueMicrotask(() => tx.oncomplete?.());
                });
                return result;
            }
            tx.objectStore = () => ({
                put(value, key) { return request(() => map.set(key, value), true); },
                delete(key) { return request(() => map.delete(key), true); },
                getAll() { return request(() => [...map.values()]); },
                getAllKeys() { return request(() => [...map.keys()]); },
                openCursor() {
                    const result = {};
                    const entries = [...map.entries()]; let i = 0;
                    function next() { queueMicrotask(() => {
                        const item = entries[i++];
                        result.result = item ? { key: item[0], value: item[1], continue: next } : null;
                        result.onsuccess?.();
                        if (!item) queueMicrotask(() => tx.oncomplete?.());
                    }); }
                    next(); return result;
                }
            });
            return tx;
        }
    };
    state.open = () => {
        const req = {};
        queueMicrotask(() => { req.result = db; req.onupgradeneeded?.(); req.onsuccess?.(); });
        return req;
    };
    return state;
}

function harness(database = localDatabase()) {
    const elements = new Map();
    const timers = new Map(); let timerId = 0;
    function element() {
        const classes = new Set();
        return {
            style: {}, children: [], handlers: {}, attributes: {}, disabled: false,
            classList: { add(x) { classes.add(x); }, remove(x) { classes.delete(x); }, contains(x) { return classes.has(x); }, toggle(x, on) { on ? classes.add(x) : classes.delete(x); } },
            addEventListener(type, fn) { this.handlers[type] = fn; },
            appendChild(child) { this.children.push(child); },
            set innerHTML(value) { this.children = []; },
            setAttribute(k, v) { this.attributes[k] = v; }, removeAttribute(k) { delete this.attributes[k]; }, hasAttribute(k) { return k in this.attributes; },
            click() { return this.handlers.click?.(); }, pause() { this.paused = true; }, load() {},
            getContext() { return { fillRect() {}, drawImage() {} }; },
            toDataURL() { return 'data:image/jpeg;base64,cGljdHVyZQ=='; }
        };
    }
    for (const match of html.matchAll(/\bid="([^"]+)"/g)) elements.set(match[1], element());
    const document = { hidden: false, handlers: {}, getElementById(id) { assert(elements.has(id), id); return elements.get(id); }, createElement: element, addEventListener(type, fn) { this.handlers[type] = fn; } };
    const tracks = [];
    function stream() { const track = { stopped: false, stop() { this.stopped = true; } }; tracks.push(track); return { getTracks: () => [track] }; }
    class Recorder {
        static isTypeSupported(type) { return type.startsWith('audio/webm'); }
        constructor(input) { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
        start() { this.state = 'recording'; }
        stop() {
            if (this.state !== 'recording') throw Error('Recorder inactive');
            this.state = 'inactive';
            queueMicrotask(() => { this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: this.mimeType }) }); this.onstop?.(); });
        }
    }
    class Reader { readAsDataURL() { this.result = 'data:image/jpeg;base64,aW5wdXQ='; queueMicrotask(() => this.onload()); } }
    class Image { constructor() { this.width = 1600; this.height = 900; } set src(value) { queueMicrotask(() => this.onload()); } }
    class Audio { constructor(url) { this.paused = true; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } }
    const window = { indexedDB: database, MediaRecorder: Recorder, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } };
    const navigator = { mediaDevices: { getUserMedia: async () => stream() } };
    const storage = new Map();
    const context = vm.createContext({ document, window, navigator, indexedDB: database, localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) }, console, Blob, URL, Audio, Image, FileReader: Reader, MediaRecorder: Recorder, confirm: () => true,
        setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); },
        setInterval() { return ++timerId; }, clearInterval() {} });
    vm.runInContext(source, context);
    return { run: text => vm.runInContext(text, context), elements, context, database, tracks, stream, timers, navigator, document, window, Audio };
}

async function main() {
    const h = harness(); await flush();
    h.run("startGame('intro1'); renderNode('intro2');");
    h.elements.get('photo-slot-btn').click();
    h.run("renderNode('intro1')");
    h.elements.get('photo-input').files = [{type:'image/jpeg',size:1024}];
    await h.elements.get('photo-input').handlers.change();
    assert(!h.elements.get('scene-area').style.background.includes('data:image'), 'Picker must not overwrite the page navigated to');
    assert(h.database.stores.get('photos').has('intro2'));
    h.run("renderNode('intro2')");
    assert(h.elements.get('scene-area').style.background.includes('data:image/jpeg'));
    assert(h.elements.get('photo-slot-btn').classList.contains('hidden'), 'Fixed page photo should stay locked');
    const restored = harness(h.database); await flush(); restored.run("startGame('intro2')");
    assert(restored.elements.get('scene-area').style.background.includes('data:image/jpeg'), 'Page photo did not restore from storage');

    h.run("renderNode('intro1')");
    await h.run('startRecording()');
    assert.equal(h.run('mediaRecorder.state'), 'recording');
    h.run('stopRecording(false)'); await flush();
    assert(h.database.stores.get('voices').has('intro1'));
    assert(h.tracks.every(track => track.stopped), 'Microphone stream not released after saving');
    assert.equal(h.run('playingNodeId'), 'intro1');
    h.run("renderNode('intro2')"); assert.equal(h.run('playingNodeId'), null, 'Previous page audio must stop');
    h.run("renderNode('intro1')"); assert.equal(h.run('playingNodeId'), 'intro1');
    h.elements.get('autoplay-toggle').click();
    h.run("renderNode('intro2'); renderNode('intro1')");
    assert.equal(h.run('playingNodeId'), null, 'Autoplay off should be respected');
    await h.run("deleteVoice('intro1')");
    assert(!h.database.stores.get('voices').has('intro1'));

    let resolvePermission;
    h.navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { resolvePermission = resolve; });
    const pending = h.run('startRecording()');
    h.run("renderNode('intro2')");
    resolvePermission(h.stream()); await pending;
    assert.equal(h.run('mediaRecorder'), null, 'Late microphone permission must not start recording on another page');
    assert(h.tracks.every(track => track.stopped));

    h.navigator.mediaDevices.getUserMedia = async () => h.stream();
    await h.run('startRecording()');
    const limit = [...h.timers.values()].find(timer => timer.ms === 90000);
    assert(limit, 'Recording time limit missing'); limit.fn(); await flush();
    assert(h.database.stores.get('voices').has('intro2'));
    const previousBlob = h.database.stores.get('voices').get('intro2').blob;
    await h.run('startRecording()'); h.run('stopRecording(false)'); await flush();
    assert.notEqual(h.database.stores.get('voices').get('intro2').blob, previousBlob, 'Rerecording must replace previous saved audio');
    await h.run('startRecording()');
    h.run("renderNode('intro1')"); await flush();
    assert.equal(h.run('mediaRecorder'), null);
    assert(!h.database.stores.get('voices').has('intro1'), 'Navigating must discard incomplete recording');

    h.database.failWrites = true;
    await h.run("deleteVoice('intro2')");
    assert(h.run("Boolean(voiceCache.intro2)"), 'Failed deletion must retain original voice');
    assert(h.elements.get('toast').textContent.includes('删除未完成'));
    h.database.failWrites = false;
    let rejectOldPlayback;
    let playCount = 0;
    h.Audio.prototype.play = function() {
        this.paused = false;
        return ++playCount === 1 ? new Promise((resolve, reject) => { rejectOldPlayback = reject; }) : Promise.resolve();
    };
    h.run("voiceCache.intro1 = { blob: voiceCache.intro2.blob }; playVoice('intro1'); playVoice('intro2');");
    rejectOldPlayback(Error('Old page autoplay blocked')); await flush();
    assert.equal(h.run('playingNodeId'), 'intro2', 'Old playback failure must not stop new page audio');
    const reopened = harness(h.database); await flush(); reopened.run("startGame('intro2')");
    assert(reopened.run('Boolean(voiceCache.intro2)'), 'Saved recording did not restore');
    await reopened.run('startRecording()');
    reopened.window.Class04Media.shutdown(); await flush();
    assert(reopened.tracks.every(track => track.stopped), 'Background cleanup must release microphone');
    console.log('Media checks passed: page photo persistence/locking, picker navigation race, recording/save/play/delete, autoplay, late permissions, 90s limit, storage failure and background cleanup.');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { harness, flush };

