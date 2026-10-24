const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = path.resolve(process.argv[2] || 'dhses4.html');
const html = fs.readFileSync(source, 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate DOM id');
const elements = new Map();
function element() {
    const classes = new Set();
    return {
        style: {}, children: [], handlers: {}, attributes: {},
        classList: {
            add(x) { classes.add(x); }, remove(x) { classes.delete(x); },
            toggle(x, on) { on ? classes.add(x) : classes.delete(x); },
            contains(x) { return classes.has(x); }
        },
        addEventListener(name, fn) { this.handlers[name] = fn; },
        appendChild(x) { this.children.push(x); },
        set innerHTML(value) { this.children = []; },
        setAttribute(k, v) { this.attributes[k] = v; },
        removeAttribute(k) { delete this.attributes[k]; },
        hasAttribute(k) { return k in this.attributes; },
        clientWidth: 800, clientLeft: 0, clientTop: 0, offsetWidth: 160, offsetHeight: 40,
        getBoundingClientRect() { return {left: 0, top: 100, width: 100}; },
        pause() {}, load() {}
    };
}
for (const id of ids) elements.set(id, element());
for (const tag of html.matchAll(/<[a-z][\w-]*\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
    const classes = tag[1].match(/\bclass="([^"]*)"/);
    if (classes) classes[1].split(/\s+/).filter(Boolean).forEach(name => elements.get(tag[2]).classList.add(name));
}
const document = {
    getElementById(id) { assert(elements.has(id), `Missing DOM element: ${id}`); return elements.get(id); },
    createElement: element
};
const context = vm.createContext({ document, console, setTimeout, assert });
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
vm.runInContext(`
    let clicks = 0;
    for (const [id, node] of Object.entries(story)) {
        renderNode(id);
        for (const char of node.chars || []) assert(CHARACTERS[char], 'Unknown character ' + char);
        for (const next of [node.next, ...(node.choices || []).map(c => c.next)].filter(Boolean))
            assert(story[next], 'Missing destination: ' + id + ' -> ' + next);
        if (node.xuPhoto) assert(XU_YI_MING_BG[node.xuPhoto], 'Unknown Xu photo');
        if (node.moments) {
            assert(!document.getElementById('moments-panel').classList.contains('hidden'));
            assert.equal(document.getElementById('moments-panel').children[2].children.length, 3);
        }
        for (let i = 0; i < (node.choices || []).length; i++) {
            renderNode(id);
            choicesContainer.children[i].handlers.click();
            assert.equal(gameState.currentNode, node.choices[i].next);
            clicks++;
        }
    }
    document.getElementById('start-btn').handlers.click();
    assert.equal(gameState.currentNode, 'intro1');
    assert.equal(document.getElementById('chapter-status').textContent, CHAPTER_TITLES[0]);
    assert(!favorBar.classList.contains('hidden'), 'Favor panel remains hidden after starting');
    for (const id of Object.keys(CHARACTERS)) {
        gameState.favor[id] = 0;
    }
    updateFavorBar();
    for (const id of Object.keys(CHARACTERS)) {
        assert.equal(document.getElementById(id + '-value').textContent, '0 / 100');
        charElements[id].handlers.click();
        assert.equal(document.getElementById(id + '-value').textContent, '1 / 100');
        assert.equal(document.getElementById(id + '-fill').style.width, '1%');
        assert.equal(document.getElementById(id + '-track').attributes['aria-valuenow'], '1');
    }
    const reached = new Set();
    function walk(id) {
        if (reached.has(id)) return;
        reached.add(id);
        const node = story[id];
        [node.next, ...(node.choices || []).map(c => c.next)].filter(Boolean).forEach(walk);
    }
    walk('intro1');
    assert.equal(reached.size, Object.keys(story).length, 'Unreachable story node');
    renderNode('xu_feed'); renderNode('intro1');
    for (const id of Object.keys(LOVE_CG_SCENES)) {
        renderNode(id);
        assert(sceneArea.classList.contains('love-cg'), 'Heart CG not shown: ' + id);
        assert(sceneArea.style.background.includes(LOVE_CG_IMAGE));
        assert(!document.getElementById('love-cg-label').classList.contains('hidden'));
        assert.equal(document.getElementById('love-cg-line').textContent, LOVE_CG_SCENES[id]);
    }
    for (const id of ['su_love_friend', 'su_love_slow', 'xu_friend_end', 'xu_slow_end', 'intro1']) {
        renderNode(id);
        assert(!sceneArea.classList.contains('love-cg'), 'CG should not show for this node: ' + id);
        assert(document.getElementById('love-cg-label').classList.contains('hidden'));
        assert(document.getElementById('love-cg-hearts').classList.contains('hidden'));
    }
    assert(document.getElementById('moments-panel').classList.contains('hidden'));
    assert(!sceneArea.classList.contains('xu-portrait'));
    renderNode('xu_team'); assert(sceneArea.classList.contains('four-characters'));
    renderNode('xu_start'); assert(!sceneArea.classList.contains('four-characters'));
    gameState.favor.xu = 99; renderNode('xu_greeting');
    choicesContainer.children[0].handlers.click();
    assert.equal(gameState.favor.xu, 100);
    assert.equal(document.getElementById('xu-fill').style.width, '100%');
    assert.equal(document.getElementById('xu-value').textContent, '100 / 100');
    for (const [id, node] of Object.entries(story)) {
        if (node.chapterResult) {
            assert(!node.choices, 'Chapter results must continue the main story');
            assert.equal(story[node.next].chapter, node.chapter + 1, 'Chapter transition: ' + id);
        }
        for (const next of [node.next, ...(node.choices || []).map(c => c.next)].filter(Boolean)) {
            if (id !== 'campus_end') assert(story[next].chapter >= node.chapter, 'Backwards chapter jump: ' + id);
        }
    }
    for (let chapter = 1; chapter <= 6; chapter++) {
        const bypass = new Set();
        function walkWithoutChapter(id) {
            if (bypass.has(id) || story[id].chapter === chapter) return;
            bypass.add(id);
            if (id === 'campus_end') return;
            const node = story[id];
            [node.next, ...(node.choices || []).map(c => c.next)].filter(Boolean).forEach(walkWithoutChapter);
        }
        walkWithoutChapter('intro1');
        assert(!bypass.has('campus_end'), 'Campaign can skip chapter ' + chapter);
    }
    renderNode('romance_sweet_end'); renderNode('su_love_sweet_end'); renderNode('xu_sweet_end'); renderNode('campus_end');
    assert.equal(Object.keys(gameState.memories).length, 3);
    choicesContainer.children[0].handlers.click();
    assert.equal(gameState.currentNode, 'intro1');
    assert.equal(Object.keys(gameState.memories).length, 0);
    assert(Object.values(gameState.favor).every(value => value === 0));
    for (const id of Object.keys(CHARACTERS)) assert.equal(document.getElementById(id + '-value').textContent, '0 / 100');
    const chaptersSeen = new Set();
    let steps = 0;
    while (gameState.currentNode !== 'campus_end') {
        assert(++steps < 200, 'Campaign cannot reach the final page');
        const node = story[gameState.currentNode];
        chaptersSeen.add(node.chapter);
        if (node.choices) choicesContainer.children[0].handlers.click();
        else dialogBox.handlers.click({ target: { closest() { return null; } } });
    }
    chaptersSeen.add(story.campus_end.chapter);
    assert.deepEqual([...chaptersSeen], [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(Object.keys(gameState.memories).length, 3);
    console.log(JSON.stringify({ storyNodes: Object.keys(story).length, xuNodes: Object.keys(story).filter(k => k.startsWith('xu_')).length, choicesVerified: clicks, allNodesReachable: true }));
`, context);
const files = new Set([...html.matchAll(/"([^"\r\n]+\.(?:jpg|png|mp4))"/g)].map(m => m[1]));
const cover = html.slice(html.indexOf('<div id="start-screen">'), html.indexOf('<!-- 好感度栏 -->'));
assert.equal((cover.match(/<button\b/g) || []).length, 1, 'Cover must have only one start button');
assert(!/id="(?:romance|su-romance|xu-romance)-btn"/.test(html), 'Special episode buttons remain');
for (const file of files) assert(fs.existsSync(path.join(path.dirname(source), file)), `Missing media ${file}`);
console.log(`Verified ${files.size} local media references: ${source}`);

