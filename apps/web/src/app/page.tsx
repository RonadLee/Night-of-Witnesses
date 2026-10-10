import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-8 md:px-12">
      <div
        aria-hidden
        className="ember-glow pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(196,92,38,0.35),transparent_70%)]"
      />
      <div
        aria-hidden
        className="steam pointer-events-none absolute bottom-24 right-16 h-24 w-40 rounded-full bg-[radial-gradient(ellipse,rgba(232,239,233,0.2),transparent_70%)]"
      />

      <header className="animate-rise mx-auto flex max-w-5xl items-end justify-between border-b border-[var(--line)] pb-6">
        <p className="text-sm tracking-[0.2em] text-[var(--fog)] uppercase">Social deduction</p>
        <p className="text-sm text-[var(--fog-dim)]">4–9 players</p>
      </header>

      <section className="mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center gap-8 py-16">
        <h1
          className="animate-rise font-[family-name:var(--font-display)] text-5xl leading-[0.95] font-extrabold tracking-tight text-[var(--paper)] md:text-7xl lg:text-8xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Night of
          <br />
          Witnesses
        </h1>
        <p
          className="animate-rise-delay max-w-xl text-lg text-[var(--fog)] md:text-xl"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Pass the cards. Fabricate a sighting. Survive the vote before someone is locked in the
          Boiler Room.
        </p>
        <div className="animate-rise-delay flex flex-col gap-3 sm:flex-row">
          <Link
            href="/solo"
            className="inline-flex items-center justify-center bg-[var(--ember)] px-8 py-4 text-base font-semibold text-[#1a0f0a] transition hover:bg-[var(--ember-hot)]"
          >
            Solo Mode
          </Link>
          <Link
            href="/multiplayer"
            className="inline-flex items-center justify-center border border-[var(--fog)] px-8 py-4 text-base font-semibold text-[var(--paper)] transition hover:border-[var(--ember)] hover:text-[var(--ember-hot)]"
          >
            Multiplayer Mode
          </Link>
        </div>
      </section>
    </main>
  );
}
