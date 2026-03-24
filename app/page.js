export default function Page() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 15% 10%, #4b1d69 0%, #0d1328 45%, #06090f 100%)',
        color: '#eaf2ff',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '24px'
      }}
    >
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          border: '1px solid rgba(143, 176, 255, 0.35)',
          borderRadius: 18,
          padding: 20,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(6px)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 34, color: '#ffcc74' }}>✦ ZEUS & AI LUXURY</h1>
          <span
            style={{
              border: '1px solid rgba(0,255,255,.45)',
              borderRadius: 999,
              padding: '6px 12px',
              fontSize: 13,
              alignSelf: 'center'
            }}
          >
            LIVE DEPLOY MARKER
          </span>
        </div>

        <p style={{ marginTop: 10, opacity: 0.9 }}>
          Interfață ZEUS activă în Next.js: dashboard futurist, module live, impact global și extensibilitate pentru următorii 30 de ani.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 18 }}>
          {[
            { label: 'Modules Online', value: '42' },
            { label: 'Resilience Index', value: '91' },
            { label: 'AI Growth', value: '76%' },
            { label: 'Global Impact Pillars', value: '4' }
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: '1px solid rgba(255,255,255,.18)',
                borderRadius: 14,
                padding: 14,
                background: 'rgba(8, 12, 24, 0.55)'
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.8 }}>{item.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#8de8ff', marginTop: 6 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
