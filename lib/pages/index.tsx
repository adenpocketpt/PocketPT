export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>PocketPT</h1>
      <p>Backend is live. POST to <code>/api/generate-plan</code> with your intake JSON.</p>
    </main>
  );
}
