// Run with: node --test tests/*.test.mjs
//
// A fake MessageChannel delivers on the microtask queue until the test silences it, which stands for
// iOS killing WebKit's network process: channels made before then go quiet, new ones work. Timers
// only fire when the test says so, so nothing depends on how fast the machine is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installSelfHealingMessageChannel } from '../Community.Blazor.MapLibre/wwwroot/workerChannel.js';

test('a message goes through the channel while it works', async () => {
    const { channel, handled, runTimers } = createChannel();

    channel.port1.postMessage(true);
    await Promise.resolve();

    assert.equal(handled.count, 1);
    runTimers();
    assert.equal(handled.count, 1);
});

test('a message still arrives after the channel has gone silent', async () => {
    const { channel, handled, silenceExistingChannels, runTimers } = createChannel();
    silenceExistingChannels();

    channel.port1.postMessage(true);
    await Promise.resolve();
    assert.equal(handled.count, 0);

    runTimers();
    assert.equal(handled.count, 1);
});

test('a silent channel is replaced, so the next message is quick again', async () => {
    const { channel, handled, silenceExistingChannels, runTimers } = createChannel();
    silenceExistingChannels();
    channel.port1.postMessage(true);
    runTimers();

    channel.port1.postMessage(true);
    await Promise.resolve();

    assert.equal(handled.count, 2);
});

test('a silenced channel that wakes up late does not run the handler again', async () => {
    const { channel, handled, silenceExistingChannels, wakeSilencedChannels, runTimers } = createChannel();
    silenceExistingChannels();
    channel.port1.postMessage(true);
    runTimers();

    wakeSilencedChannels();
    await Promise.resolve();

    assert.equal(handled.count, 1);
});

test('a replaced channel is closed', () => {
    const { channel, channels, silenceExistingChannels, runTimers } = createChannel();
    silenceExistingChannels();

    channel.port1.postMessage(true);
    runTimers();

    assert.deepEqual(channels.map(c => c.isClosed), [true, false]);
});

test('the scope is left alone when it has no MessageChannel', () => {
    const scope = { setTimeout, clearTimeout };

    installSelfHealingMessageChannel(scope, 50);

    assert.equal(scope.MessageChannel, undefined);
});

function createChannel() {
    const channels = [];
    const timers = new Map();
    let nextTimerId = 1;

    class FakeMessageChannel {
        constructor() {
            this.isSilent = false;
            this.isClosed = false;
            this.heldMessages = 0;
            this.port2 = { onmessage: null, close: () => this.isClosed = true };
            this.port1 = {
                postMessage: () => {
                    if (this.isSilent) {
                        this.heldMessages++;
                        return;
                    }
                    queueMicrotask(() => this.port2.onmessage?.({ data: true }));
                },
                close: () => this.isClosed = true
            };
            channels.push(this);
        }
    }

    const scope = {
        MessageChannel: FakeMessageChannel,
        setTimeout: callback => {
            timers.set(nextTimerId, callback);
            return nextTimerId++;
        },
        clearTimeout: id => timers.delete(id)
    };
    installSelfHealingMessageChannel(scope, 50);

    const handled = { count: 0 };
    const channel = new scope.MessageChannel();
    channel.port2.onmessage = () => handled.count++;

    return {
        channel,
        channels,
        handled,
        runTimers: () => {
            const due = [...timers.values()];
            timers.clear();
            due.forEach(callback => callback());
        },
        silenceExistingChannels: () => channels.forEach(c => c.isSilent = true),
        wakeSilencedChannels: () => channels
            .filter(c => c.isSilent)
            .forEach(c => {
                for (; c.heldMessages > 0; c.heldMessages--) {
                    c.port2.onmessage?.({ data: true });
                }
            })
    };
}
