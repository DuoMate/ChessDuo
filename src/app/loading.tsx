export default function Loading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#0f1119',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      <img
        src="/loading/logo.png"
        alt="ChessDuo"
        style={{
          width: 'min(280px, 60vw)',
          height: 'auto',
          objectFit: 'contain',
          animation: 'logoPulse 2.4s ease-in-out infinite',
        }}
      />

      <p
        style={{
          fontFamily: 'inherit',
          fontSize: 'clamp(18px, 5vw, 26px)',
          fontWeight: 800,
          color: '#facc15',
          letterSpacing: '0.1em',
          marginTop: '20px',
          marginBottom: '4px',
        }}
      >
        ChessDuo
      </p>
      <p
        style={{
          fontFamily: 'inherit',
          fontSize: 'clamp(9px, 2.5vw, 11px)',
          color: '#6b7280',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        Play Smarter, Together
      </p>

      <div
        style={{
          width: 'min(200px, 50vw)',
          height: '3px',
          borderRadius: '9999px',
          background: 'rgba(255,255,255,0.06)',
          marginTop: '36px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, #facc15 50%, transparent 100%)',
            animation: 'shimmer 1.8s linear infinite',
            backgroundSize: '200% 100%',
          }}
        />
      </div>

      <p
        style={{
          fontFamily: 'inherit',
          fontSize: 'clamp(10px, 2.5vw, 12px)',
          color: '#4b5563',
          marginTop: '16px',
          letterSpacing: '0.05em',
        }}
      >
        Preparing board...
      </p>

      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}