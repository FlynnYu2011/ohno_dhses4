const assert = require('node:assert/strict');
const { harness } = require('./verify-media.cjs');
const h = harness();
function state() { return JSON.parse(h.run('JSON.stringify(miniGame && {deck:miniGame.deck,moves:miniGame.moves,open:miniGame.open,done:miniGame.done,matched:[...miniGame.matched]})')); }
function clickCard(index) { h.elements.get('minigame-board').children[index].click(); }
function solve() {
    const deck = state().deck;
    for (const symbol of new Set(deck)) {
        const pair = deck.map((s,i) => s === symbol ? i : -1).filter(i => i >= 0);
        clickCard(pair[0]); clickCard(pair[1]);
    }
}
function waitMismatch() {
    const entry = [...h.timers.entries()].find(([,timer]) => timer.ms === 650);
    assert(entry, 'Mismatch timer missing');
    h.timers.delete(entry[0]); entry[1].fn();
}
h.run("startGame('intro1')");
assert(h.elements.get('challenge-bar').classList.contains('hidden'));
h.run("renderNode('chapter1')");
assert(!h.elements.get('challenge-bar').classList.contains('hidden'));
h.elements.get('challenge-target').value = 'xu';
h.elements.get('challenge-launch').click();
assert.equal(state().deck.length, 8);
const firstDeck = state().deck;
const other = firstDeck.findIndex(s => s !== firstDeck[0]);
for (let i = 0; i < 13; i++) {
    clickCard(0); clickCard(other);
    const before = state().moves;
    clickCard(firstDeck.findIndex((s,index) => index !== 0 && index !== other));
    assert.equal(state().moves, before, 'Input during mismatch should be ignored');
    waitMismatch();
}
solve();
assert.equal(state().moves, 17);
assert.equal(h.run('gameState.favor.xu'), 12);
assert.equal(h.run("gameState.miniGameBest['1:xu']"), 12);
h.elements.get('minigame-restart').click(); solve();
assert.equal(h.run('gameState.favor.xu'), 20, 'Improvement must add only the eight point difference');
h.elements.get('minigame-restart').click(); solve();
assert.equal(h.run('gameState.favor.xu'), 20, 'Repeated perfect result must not farm points');
h.elements.get('challenge-target').value = 'lu';
h.elements.get('minigame-restart').click();
const slowDeck = state().deck;
const slowOther = slowDeck.findIndex(s => s !== slowDeck[0]);
for (let i = 0; i < 19; i++) { clickCard(0); clickCard(slowOther); waitMismatch(); }
solve();
assert.equal(h.run('gameState.favor.lu'), 6, 'More than 18 moves should earn the six point tier');
h.elements.get('minigame-restart').click(); solve();
assert.equal(h.run('gameState.favor.lu'), 20, 'Different characters have independent rewards');
h.run("renderNode('chapter2_open'); gameState.favor.xu = 80; updateFavorBar();");
h.elements.get('challenge-target').value = 'xu';
h.elements.get('challenge-launch').click(); solve();
assert.equal(h.run('gameState.favor.xu'), 100);
assert.equal(h.run('gameState.celebratedCharacters.size'), 1);
assert(!h.elements.get('max-favor-effect').classList.contains('hidden'));
assert(h.elements.get('max-favor-name').textContent.includes('徐一鸣'));
assert(h.elements.get('xu-favor-card').classList.contains('favor-max'));
assert.equal(h.elements.get('celebration-hearts').children.length, 18);
h.run("awardFavor({xu:20}, '重复奖励测试')");
assert.equal(h.run('gameState.favor.xu'), 100);
assert.equal(h.run('gameState.celebratedCharacters.size'), 1);
h.elements.get('minigame-restart').click();
const pendingDeck = state().deck;
clickCard(0); clickCard(pendingDeck.findIndex(s => s !== pendingDeck[0]));
h.run("renderNode('chapter2_end')");
assert.equal(state(), null);
assert(h.elements.get('minigame-panel').classList.contains('hidden'));
const pointsAfterNavigation = h.run('gameState.favor.xu');
for (const [,timer] of h.timers) if (timer.ms === 650) timer.fn();
assert.equal(h.run('gameState.favor.xu'), pointsAfterNavigation);
h.run("renderNode('campus_end')"); h.elements.get('choices-container').children[0].click();
assert.equal(h.run('gameState.celebratedCharacters.size'), 0);
assert.equal(h.run('Object.keys(gameState.miniGameBest).length'), 0);
assert(h.elements.get('max-favor-effect').classList.contains('hidden'));
assert(Object.values(h.run('gameState.favor')).every(value => value === 0));
for (const node of ['chapter1','chapter2_open','romance_start','chapter4_open','chapter5_open']) {
    h.run('renderNode(' + JSON.stringify(node) + ')');
    for (const id of ['shen','lu','su','xu']) {
        h.elements.get('challenge-target').value = id;
        h.elements.get('challenge-launch').click(); solve();
    }
}
assert(Object.values(h.run('gameState.favor')).every(value => value === 100), 'All characters must remain attainable through skilled play');
console.log('Minigame checks passed: matching, mismatch lock, graded scores, best-score delta, per-character/chapter rewards, navigation cleanup, max-affection effect and new-game reset.');
