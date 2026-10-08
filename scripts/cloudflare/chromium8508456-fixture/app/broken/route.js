export const dynamic = "force-dynamic";
export function GET() {
  return new Response(
    "<html><body><h1>Synthetic navigation failure</h1></body></html>",
    {
      status: 503,
      headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
    },
  );
}
