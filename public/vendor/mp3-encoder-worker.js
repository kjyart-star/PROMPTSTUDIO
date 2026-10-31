/* MP3 인코딩 워커 — lamejs 로 청크씩 받아 인코딩한다(화면이 멈추지 않게, 메모리는 청크 단위).
 * 메시지: {type:'init',channels,rate,kbps} → {type:'pcm',l,r?}(Int16 버퍼, 건마다 {type:'ack'}) → {type:'end'} → {type:'done',chunks} */
self.importScripts('lamejs.min.js')
var enc = null
var out = []
self.onmessage = function (e) {
  var m = e.data
  try {
    if (m.type === 'init') {
      enc = new self.lamejs.Mp3Encoder(m.channels, m.rate, m.kbps)
      out = []
    } else if (m.type === 'pcm') {
      var b = enc.encodeBuffer(new Int16Array(m.l), m.r ? new Int16Array(m.r) : undefined)
      if (b.length) out.push(b)
      self.postMessage({ type: 'ack' })
    } else if (m.type === 'end') {
      var f = enc.flush()
      if (f.length) out.push(f)
      self.postMessage({ type: 'done', chunks: out }, out.map(function (c) { return c.buffer }))
      out = []
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message || err) })
  }
}
