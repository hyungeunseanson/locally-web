export const dynamic = "force-dynamic";
export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const cache = q.get("cache") === "no-cache" ? "no-cache" : "no-store";
  const fault = q.get("fault") || "none";
  const writes = Number(q.get("writes") || 2);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": cache,
    "Content-Encoding": "identity",
  };
  if (fault === "length-mismatch") {
    headers["Content-Length"] = "12";
    headers.Connection = "close";
  }
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (writes === 1) {
          controller.enqueue(encoder.encode('{"ok":true}'));
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode('{"ok":'));
        await delay(fault === "abort" ? 200 : 20);
        if (fault === "reader-error") {
          controller.error(new Error("synthetic_reader_error"));
          return;
        }
        if (fault === "truncated") {
          controller.close();
          return;
        }
        if (writes === 3) {
          controller.enqueue(encoder.encode("tr"));
          await delay(20);
          controller.enqueue(encoder.encode("ue}"));
          await delay(20);
        } else controller.enqueue(encoder.encode("true}"));
        controller.close();
      } catch {
        /* Intentional client-abort negative control can close the stream. */
      }
    },
  });
  return new Response(stream, {
    status: fault === "http-503" ? 503 : 200,
    headers,
  });
}
