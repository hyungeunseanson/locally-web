"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Synthetic eligibility only: no accounts, credentials, providers or database.
export default function Surface({ title, variant, role, children }) {
  const router = useRouter();
  const [resolved, setResolved] = useState(false);
  const [mode, setMode] = useState("guest");
  const timer = useRef(null);
  const eligible = resolved && role === "host";
  const query = "?variant=" + variant + "&role=" + role;
  const account = "/account" + query;
  const host = "/host/dashboard" + query + "&tab=reservations";
  // Preserve the original diagnostic hydration/eligibility transition.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved(true);
  }, []);
  useEffect(() => {
    router.prefetch(account);
  }, [account, router]);
  useEffect(() => {
    if (variant === "original") router.prefetch(host);
  }, [variant, host, router]);
  useEffect(() => {
    if (variant === "conditional" && eligible) router.prefetch(host);
  }, [variant, eligible, host, router]);
  useEffect(() => () => clearTimeout(timer.current), []);
  function switchHost() {
    setMode("host");
    router.prefetch(host);
    timer.current = setTimeout(() => router.push(host), 900);
  }
  return (
    <>
      <h1>{title}</h1>
      <p data-testid="resolved">{String(resolved)}</p>
      <p data-testid="mode">{mode}</p>
      <nav>
        <Link prefetch={false} href={"/" + query}>
          Home
        </Link>{" "}
        <Link prefetch={false} href={"/detail/example" + query}>
          Detail
        </Link>
        {eligible && <button onClick={switchHost}>Host View</button>}
      </nav>
      {children}
    </>
  );
}
