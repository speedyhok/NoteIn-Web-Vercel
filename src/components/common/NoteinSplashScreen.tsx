import React from 'react';
import { NoteinFeatherIcon } from './FeatherLoader';

interface NoteinSplashScreenProps {
  isFadingOut?: boolean;
}

/**
 * Authentic NoteIn Android Opening Launch Splash Screen
 * Directly models NoteIn Android APK Theme.App.Starting & splash_screen_view.xml
 */
export const NoteinSplashScreen: React.FC<NoteinSplashScreenProps> = ({ isFadingOut = false }) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'var(--bg-primary, #ffffff)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '48px 24px',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s ease',
        transform: isFadingOut ? 'scale(1.02)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      {/* Top subtle branding indicator */}
      <div
        style={{
          padding: '6px 16px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(63, 82, 255, 0.08)',
          color: '#3f52ff',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        NoteIn Android Studio Architecture
      </div>

      {/* Center Branding Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          marginTop: '-40px',
        }}
      >
        {/* Animated Quill Feather */}
        <div
          className="notein-feather-float-anim"
          style={{
            position: 'relative',
            marginBottom: '28px',
            filter: 'drop-shadow(0 12px 24px rgba(0, 145, 255, 0.2))',
          }}
        >
          <NoteinFeatherIcon size={108} />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '38px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary, #0f172a)',
            margin: '0 0 8px 0',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          NoteIn
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--text-secondary, #64748b)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Handwritten Notes &amp; PDF Annotation
        </p>
      </div>

      {/* Bottom Footer Watermark */}
      <div
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--text-muted, #94a3b8)',
          letterSpacing: '0.04em',
        }}
      >
        Orion NoteIn Global
      </div>
    </div>
  );
};
