import { Suspense } from "react";
import Surface from "../../surface";
export const dynamic = "force-dynamic";
async function Content() {
  await new Promise((resolve) => setTimeout(resolve, 20));
  return <p>{"Synthetic content only. ".repeat(2000)}</p>;
}
export default async function Page({ searchParams }) {
  const q = await searchParams;
  return (
    <Surface
      title="Detail"
      variant={q.variant === "conditional" ? "conditional" : "original"}
      role={q.role === "host" ? "host" : "anonymous"}
    >
      <Suspense fallback={<p>Loading synthetic stream</p>}>
        <Content />
      </Suspense>
    </Surface>
  );
}
