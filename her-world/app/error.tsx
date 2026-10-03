"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="section"><h1>Let’s try that again.</h1><p>The page couldn’t finish loading. Please retry.</p><button className="button pink" onClick={reset}>Reload this page</button></main>;
}
