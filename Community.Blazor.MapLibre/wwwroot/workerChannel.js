// On iOS, a map that comes back from the background can stay white for good. WebKit routes
// MessageChannel traffic through its network process, and when iOS kills that process in the
// background, every channel made before then goes silent without an error. MapLibre's worker
// queues each incoming message behind such a channel, so the worker still receives tile requests
// but never handles them. This gives the worker a channel that heals itself: a message still goes
// through a real channel, but if it hasn't arrived within fallbackMs the handler runs anyway and
// the channel is replaced.

const fallbackMs = 50;

// Runs inside the worker, so it must not refer to anything outside itself.
export function installSelfHealingMessageChannel(scope, fallbackMs) {
    const RealMessageChannel = scope.MessageChannel;
    if (!RealMessageChannel) {
        return;
    }

    // MapLibre only sets port2.onmessage and calls port1.postMessage, with one message in flight.
    scope.MessageChannel = class SelfHealingMessageChannel {
        constructor() {
            const channel = this;
            this.handler = null;
            this.isPending = false;
            this.port1 = { postMessage() { channel.post(); } };
            this.port2 = {
                get onmessage() { return channel.handler; },
                set onmessage(handler) { channel.handler = handler; }
            };
            this.connect();
        }

        connect() {
            if (this.realChannel) {
                this.realChannel.port2.onmessage = null;
            }
            this.realChannel = new RealMessageChannel();
            this.realChannel.port2.onmessage = () => this.deliver();
        }

        post() {
            this.isPending = true;
            this.realChannel.port1.postMessage(true);
            scope.clearTimeout(this.fallbackTimer);
            this.fallbackTimer = scope.setTimeout(() => {
                if (!this.isPending) {
                    return;
                }
                this.connect();
                this.deliver();
            }, fallbackMs);
        }

        deliver() {
            this.isPending = false;
            scope.clearTimeout(this.fallbackTimer);
            this.handler?.({ data: true });
        }
    };
}

let selfHealingWorkerUrl = null;

// MapLibre makes its worker URL when it loads and creates the workers with the first map, so the
// URL has to be swapped in between. Swapping it twice would wrap the bootstrap in itself.
export function useSelfHealingChannelInWorkers(maplibregl) {
    const workerUrl = maplibregl.getWorkerUrl();
    if (workerUrl === selfHealingWorkerUrl) {
        return;
    }

    const bootstrap = `(${installSelfHealingMessageChannel})(self, ${fallbackMs});
importScripts(${JSON.stringify(workerUrl)});`;
    selfHealingWorkerUrl = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }));
    maplibregl.setWorkerUrl(selfHealingWorkerUrl);
}
