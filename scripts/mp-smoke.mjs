import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { Client } = require('colyseus.js');

const url = process.env.GAME_URL ?? 'ws://127.0.0.1:2567';

function waitFor(room, type, predicate, ms = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), ms);
    room.onMessage(type, (message) => {
      if (!predicate || predicate(message)) {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
}

const ids = ['p_smoke01', 'p_smoke02', 'p_smoke03', 'p_smoke04'];
const host = new Client(url);
const hostRoom = await host.create('game', { name: 'Ada', playerId: ids[0] });
const sessionPromise = waitFor(hostRoom, 'session', (msg) => Boolean(msg.code));
hostRoom.send('ping_view');
const session = await sessionPromise;
const code = session.code;
console.log('created', code);

const rooms = [hostRoom];
for (let i = 1; i < 4; i++) {
  const client = new Client(url);
  const room = await client.join('game', { name: `Player ${i + 1}`, playerId: ids[i], code });
  rooms.push(room);
  room.onMessage('error', (msg) => console.log('error', ids[i], msg));
}
console.log('joined', rooms.length);

hostRoom.onMessage('error', (msg) => console.log('host error', msg));
for (const room of rooms) room.send('ready', { ready: true });
await waitFor(hostRoom, 'lobby', (msg) => msg.canStart === true, 8000);
hostRoom.send('start');
const started = await waitFor(hostRoom, 'view', (msg) => msg.mode === 'boiler' && msg.view?.public?.phase === 'passing', 8000);
const hand = started.view.private.hand;
const target = started.view.private.passTarget;
if (!hand || hand.length !== 2 || !target) throw new Error('host did not receive a private hand');
const outsider = await waitFor(rooms[1], 'view', (msg) => msg.mode === 'boiler');
if (JSON.stringify(outsider.view.private.hand) !== '[]') throw new Error('hand leaked to another player');
hostRoom.send('action', {
  type: 'confirm_pass',
  passIndex: 0,
  targetPlayerId: target.playerId ?? 'unseated',
  nonce: 'smoke-pass',
});
const passed = await waitFor(rooms[1], 'view', (msg) => (msg.view?.public?.passes?.length ?? 0) > 0);
console.log('pass', passed.view.public.passes[0].text ?? passed.view.public.activity.at(-1)?.text);
for (const room of rooms) room.leave();
console.log('smoke ok');
