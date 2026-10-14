// Run with: node --test tests/*.test.mjs
//
// A fake MessageChannel delivers on the microtask queue until the test silences it, which stands for
// iOS killing WebKit's network process: channels made before then go quiet, new ones work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { installSelfHealingMessageChannel } from '../Community.Blazor.MapLibre/wwwroot/workerChannel.js';

const fallbackMs = 20;

test('a message goes through the channel while it works', async () => {
    const { channel, handled } = createChannel();

    channel.port1.postMessage(true);
    await Promise.resolve();

    assert.equal(handled.count, 1);
    await sleep(fallbackMs * 2);
    assert.equal(handled.count, 1);
});

test('a message still arrives after the channel has gone silent', async () => {
    const { channel, handled, silenceExistingChannels } = createChannel();
    silenceExistingChannels();

    channel.port1.postMessage(true);
    await Promise.resolve();
    assert.equal(handled.count, 0);

    await sleep(fallbackMs * 2);
    assert.equal(handled.count, 1);
});

test('a silent channel is replaced, so the next message is quick again', async () => {
    const { channel, handled, silenceExistingChannels } = createChannel();
    silenceExistingChannels();
    channel.port1.postMessage(true);
    await sleep(fallbackMs * 2);

    channel.port1.postMessage(true);
    await Promise.resolve();

    assert.equal(handled.count, 2);
});

test('a silenced channel that wakes up late does not run the handler again', async () => {
    const { channel, handled, silenceExistingChannels, wakeSilencedChannels } = createChannel();
    silenceExistingChannels();
    channel.port1.postMessage(true);
    await sleep(fallbackMs * 2);

    wakeSilencedChannels();
    await Promise.resolve();

    assert.equal(handled.count, 1);
});

test('the scope is left alone when it has no MessageChannel', () => {
    const scope = { setTimeout, clearTimeout };

    installSelfHealingMessageChannel(scope, fallbackMs);

    assert.equal(scope.MessageChannel, undefined);
});

function createChannel() {
    const channels = [];

    class FakeMessageChannel {
        constructor() {
            this.isSilent = false;
            this.heldMessages = 0;
            this.port2 = { onmessage: null };
            this.port1 = {
                postMessage: () => {
                    if (this.isSilent) {
                        this.heldMessages++;
                        return;
                    }
                    queueMicrotask(() => this.port2.onmessage?.({ data: true }));
                }
            };
            channels.push(this);
        }
    }

    const scope = { MessageChannel: FakeMessageChannel, setTimeout, clearTimeout };
    installSelfHealingMessageChannel(scope, fallbackMs);

    const handled = { count: 0 };
    const channel = new scope.MessageChannel();
    channel.port2.onmessage = () => handled.count++;

    return {
        channel,
        handled,
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
