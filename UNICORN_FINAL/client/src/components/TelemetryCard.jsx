import React from 'react';

// TelemetryCard – metric display card for dashboards
const TelemetryCard = ({
  title,
  value,
  unit = '',
  change,
  changeLabel,
  icon,
  color = '#a78bfa',
  accent = '#fbbf24',
  loading = false,
  size = 'md',
}) => {
  const positive = change > 0;
  const sizeMap = { sm: { card: 140, title: 11, val: 22, icon: 28 }, md: { card: 180, title: 12, val: 28, icon: 34 }, lg: { card: 220, title: 14, val: 36, icon: 40 } };
  const s = sizeMap[size] || sizeMap.md;

  return (
    <div
      style={{
        minWidth: s.card,
        background: `linear-gradient(135deg, rgba(10,5,32,0.9), rgba(26,10,58,0.8))`,
        border: `1px solid ${color}44`,
        borderRadius: 14,
        padding: '16px 20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 0 20px ${color}22, inset 0 1px 0 ${color}22`,
        transition: 'box-shadow 0.3s, transform 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 35px ${color}44, inset 0 1px 0 ${color}44`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 20px ${color}22, inset 0 1px 0 ${color}22`; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Accent stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, ${accent}, transparent)`,
      }} />

      {/* Background glow circle */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}22, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ color: '#94a3b8', fontSize: s.title, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {title}
        </div>
        {icon && (
          <div style={{ fontSize: s.icon * 0.6, lineHeight: 1 }}>{icon}</div>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <div style={{
          height: s.val, background: 'rgba(167,139,250,0.15)',
          borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite',
          width: '70%',
        }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            color: color,
            fontSize: s.val,
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: -0.5,
            lineHeight: 1,
          }}>
            {value ?? '—'}
          </span>
          {unit && (
            <span style={{ color: '#64748b', fontSize: s.title, fontWeight: 500 }}>{unit}</span>
          )}
        </div>
      )}

      {/* Change indicator */}
      {change !== undefined && !loading && (
        <div style={{
          marginTop: 8,
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600,
          color: positive ? '#22c55e' : '#ef4444',
        }}>
          <span>{positive ? '▲' : '▼'}</span>
          <span>{Math.abs(change)}{typeof change === 'number' && change < 100 ? '%' : ''}</span>
          {changeLabel && <span style={{ color: '#64748b', fontWeight: 400 }}>{changeLabel}</span>}
        </div>
      )}
    </div>
  );
};

export default TelemetryCard;
