// Local diagnostic observer only. Never used in the product/release Gate.
// Does not issue reads, tee/clone/cancel, alter cache policy or persist payload.
export function installReaderObserver() {
  const streams = new WeakMap(),
    readers = new WeakMap();
  let requestSeq = 0,
    readerSeq = 0;
  window.__rscReaderFacts = [];
  const fetchOriginal = window.fetch;
  window.fetch = function (...args) {
    const input = args[0],
      options = args[1],
      url = new URL(
        input instanceof Request ? input.url : String(input),
        location.href,
      ).href;
    const h = new Headers(
      options?.headers ||
        (input instanceof Request ? input.headers : undefined),
    );
    const fact = {
      id: "fetch" + ++requestSeq,
      url,
      started: performance.now(),
      rsc: h.get("RSC") === "1",
      prefetch: h.get("Next-Router-Prefetch") === "1",
      channels: [],
    };
    window.__rscReaderFacts.push(fact);
    return Reflect.apply(fetchOriginal, this, args).then(
      (response) => {
        fact.responseAt = performance.now();
        fact.status = response.status;
        fact.cacheControl = response.headers.get("Cache-Control");
        fact.contentType = response.headers.get("Content-Type");
        if (response.body)
          streams.set(response.body, { fact, path: "original-body" });
        return response;
      },
      (error) => {
        fact.fetchError = error.name;
        throw error;
      },
    );
  };
  const teeOriginal = ReadableStream.prototype.tee;
  ReadableStream.prototype.tee = function (...args) {
    const result = Reflect.apply(teeOriginal, this, args),
      parent = streams.get(this);
    if (parent)
      result.forEach((s, i) =>
        streams.set(s, { fact: parent.fact, path: parent.path + "/tee" + i }),
      );
    return result;
  };
  const cloneOriginal = Response.prototype.clone;
  Response.prototype.clone = function (...args) {
    const parent = streams.get(this.body),
      result = Reflect.apply(cloneOriginal, this, args);
    if (parent) {
      if (this.body)
        streams.set(this.body, {
          fact: parent.fact,
          path: parent.path + "/clone-original",
        });
      if (result.body)
        streams.set(result.body, {
          fact: parent.fact,
          path: parent.path + "/clone-copy",
        });
    }
    return result;
  };
  const getOriginal = ReadableStream.prototype.getReader;
  ReadableStream.prototype.getReader = function (...args) {
    const result = Reflect.apply(getOriginal, this, args),
      parent = streams.get(this);
    if (parent) {
      const row = {
        readerId: "reader" + ++readerSeq,
        path: parent.path,
        reads: 0,
        chunks: [],
        bytes: 0,
        eof: false,
        error: null,
        cancelCalled: false,
      };
      parent.fact.channels.push(row);
      readers.set(result, row);
    }
    return result;
  };
  for (const prototype of [
    ReadableStreamDefaultReader.prototype,
    globalThis.ReadableStreamBYOBReader?.prototype,
  ].filter(Boolean)) {
    const readOriginal = prototype.read,
      cancelOriginal = prototype.cancel;
    prototype.read = function (...args) {
      const row = readers.get(this);
      return Reflect.apply(readOriginal, this, args).then(
        (result) => {
          if (row) {
            row.reads++;
            if (result.value?.byteLength) {
              row.chunks.push(result.value.byteLength);
              row.bytes += result.value.byteLength;
            }
            if (result.done) {
              row.eof = true;
              row.eofAt = performance.now();
            }
          }
          return result;
        },
        (error) => {
          if (row) {
            row.error = error.name;
            row.errorAt = performance.now();
          }
          throw error;
        },
      );
    };
    prototype.cancel = function (...args) {
      const row = readers.get(this);
      if (row) {
        row.cancelCalled = true;
        row.cancelAt = performance.now();
      }
      return Reflect.apply(cancelOriginal, this, args);
    };
  }
}
