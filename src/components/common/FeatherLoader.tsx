import React from 'react';

interface FeatherLoaderProps {
  message?: string;
  subMessage?: string;
  size?: number;
  inline?: boolean;
}

/**
 * Authentic NoteIn Feather Vector Component
 * Directly derived from NoteIn Android APK splash_feather.xml & $splash_feather__0.xml
 */
export const NoteinFeatherIcon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 64,
  className,
  style,
}) => {
  const gradientId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 135"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', overflow: 'visible', ...style }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="27.104"
          y1="27.48"
          x2="27.104"
          y2="120.0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00dac3" />
          <stop offset="31.6%" stopColor="#0091ff" />
          <stop offset="62.4%" stopColor="#ff4245" />
          <stop offset="100%" stopColor="#f7b500" />
        </linearGradient>
      </defs>
      <g transform="translate(6, 6)">
        <path
          fill={`url(#${gradientId})`}
          d="M82.8747,109.2119 L79.4932,102.3897 C73.1017,89.9269 65.5948,77.5127 60.2206,69.8573 C36.9563,36.7103 12.0179,9.189 0,0 C0.7944,6.4131 4.1522,18.1604 8.3534,26.0325 C10.2173,26.251 16.0831,27.3952 17.9454,28.0182 C18.4766,28.0808 9.4861,27.7128 9.8181,28.2723 C10.7263,30.2571 12.0092,32.9574 13.5758,36.0855 L16.491,41.7607 C20.4274,49.2301 25.4143,57.9176 30.6225,65.1657 C35.905,66.0306 43.3826,65.9166 47.1965,65.0386 C42.0989,67.9211 37.6337,68.007 32.499,67.6978 C35.7161,71.9066 38.9807,75.455 42.0989,77.7284 C46.81,81.1675 50.6349,81.558 55.919,81.5524 C53.2726,82.3771 50.4689,82.9861 47.5008,83.3765 C51.789,84.6552 61.1929,84.1032 64.4922,83.5923 C65.4186,83.0281 72.052,93.6313 72.6472,94.8511 C73.1894,95.9645 73.5823,96.9901 73.8486,97.9456 C75.0051,102.0806 74.2288,105.5094 72.9215,107.7184 C78.0166,111.7786 83.0241,114.6134 87.6316,120 C86.2602,116.5656 84.6453,112.9266 82.8747,109.2119 Z"
        />
      </g>
    </svg>
  );
};

/**
 * NoteIn Animated Feather Loader
 * Features dynamic writing motion, gradient glow, and drawing stroke animation.
 */
export const FeatherLoader: React.FC<FeatherLoaderProps> = ({
  message = 'Loading NoteIn Studio...',
  subMessage,
  size = 72,
  inline = false,
}) => {
  if (inline) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <div className="notein-feather-inline-anim" style={{ display: 'inline-block' }}>
          <NoteinFeatherIcon size={Math.round(size * 0.4)} />
        </div>
        {message && <span style={{ fontSize: '13px', fontWeight: 600 }}>{message}</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        textAlign: 'center',
        gap: '16px',
      }}
    >
      <div style={{ position: 'relative', width: `${size}px`, height: `${size * 1.15}px` }}>
        {/* Animated Feather */}
        <div className="notein-feather-float-anim">
          <NoteinFeatherIcon size={size} />
        </div>

        {/* Ink flourish line under the nib */}
        <svg
          width={size * 1.2}
          height="18"
          viewBox="0 0 100 16"
          style={{
            position: 'absolute',
            bottom: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            overflow: 'visible',
          }}
        >
          <path
            d="M 5,8 Q 30,2 50,8 T 95,8"
            fill="none"
            stroke="url(#featherInkGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            className="notein-feather-ink-anim"
          />
          <defs>
            <linearGradient id="featherInkGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00dac3" />
              <stop offset="50%" stopColor="#0091ff" />
              <stop offset="100%" stopColor="#ff4245" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div style={{ marginTop: '10px' }}>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {message}
        </div>
        {subMessage && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {subMessage}
          </div>
        )}
      </div>
    </div>
  );
};