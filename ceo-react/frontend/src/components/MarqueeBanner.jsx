import React from 'react';

export default function MarqueeBanner({ ad }) {
  if (!ad) return null;
  const isMobile = window.innerWidth <= 768;

  const duration = Math.max(5, Math.round(120 / (ad.Speed / 10)));

  return (
    <div style={{
      position: 'fixed',
      top: 64,
      left: isMobile ? 0 : 250,
      right: 0,
      background: ad.BgColor || '#1e293b',
      overflow: 'hidden',
      height: 32,
      display: 'flex',
      alignItems: 'center',
      zIndex: 98,
    }}>
      <style>{`
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll ${duration}s linear infinite;
          white-space: nowrap;
        }
        .marquee-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="marquee-track">
        {/* Duplicate text so it loops seamlessly */}
        {[0, 1].map(i => (
          <span key={i} style={{
            color: ad.TextColor || '#ffffff',
            fontSize: (ad.FontSize || 13) + 'px',
            fontWeight: ad.FontWeight || 'normal',
            padding: '0 60px',
            letterSpacing: 0.3,
          }}>
            {ad.Content}
          </span>
        ))}
      </div>
    </div>
  );
}
