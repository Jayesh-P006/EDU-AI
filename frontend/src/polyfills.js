import { Buffer } from 'buffer'

globalThis.Buffer = Buffer

if (typeof globalThis.process === 'undefined') {
    globalThis.process = { env: {}, version: '', platform: 'browser', nextTick: (cb) => setTimeout(cb, 0) }
}
