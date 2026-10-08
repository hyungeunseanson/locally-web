import Surface from "../surface";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }) {
  const q = await searchParams;
  return (
    <Surface
      title="Account"
      variant={q.variant === "conditional" ? "conditional" : "original"}
      role={q.role === "host" ? "host" : "anonymous"}
    />
  );
}
