import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import './ProfileCard.css';

interface ProfileCardProps {
  avatarUrl?: string;
  iconUrl?: string;
  grainUrl?: string;
  innerGradient?: string;
  behindGlowEnabled?: boolean;
  behindGlowColor?: string;
  behindGlowSize?: string;
  className?: string;
  enableTilt?: boolean;
  enableMobileTilt?: boolean;
  mobileTiltSensitivity?: number;
  miniAvatarUrl?: string;
  name?: string;
  title?: string;
  handle?: string;
  status?: string;
  contactText?: string;
  showUserInfo?: boolean;
  onContactClick?: () => void;
}

const DEFAULT_INNER_GRADIENT = 'linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)';

const ANIMATION_CONFIG = {
  INITIAL_DURATION: 1200,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  DEVICE_BETA_OFFSET: 20,
  ENTER_TRANSITION_MS: 180
};

const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const round = (v: number, precision = 3) => parseFloat(v.toFixed(precision));
const adjust = (v: number, fMin: number, fMax: number, tMin: number, tMax: number) => 
  round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

const ProfileCardComponent: React.FC<ProfileCardProps> = ({
  avatarUrl = 'https://picsum.photos/id/64/800/1200',
  iconUrl = 'https://raw.githubusercontent.com/simeydotme/pokemon-cards-css/main/public/img/overlay_glass.png',
  grainUrl = 'https://raw.githubusercontent.com/simeydotme/pokemon-cards-css/main/public/img/grain.webp',
  innerGradient,
  behindGlowEnabled = true,
  behindGlowColor,
  behindGlowSize,
  className = '',
  enableTilt = true,
  enableMobileTilt = false,
  mobileTiltSensitivity = 5,
  miniAvatarUrl,
  name = "Cookaracha",
  title = "Visual Artist",
  handle = "cookaracha",
  status = "Active",
  contactText = "gay",
  showUserInfo = true,
  onContactClick
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  const leaveRafRef = useRef<number | null>(null);

  const tiltEngine = useMemo(() => {
    if (!enableTilt) return null;
    let rafId: number | null = null;
    let running = false;
    let lastTs = 0;
    let currentX = 0, currentY = 0, targetX = 0, targetY = 0;
    const DEFAULT_TAU = 0.14;
    const INITIAL_TAU = 0.6;
    let initialUntil = 0;

    const setVarsFromXY = (x: number, y: number) => {
      const shell = shellRef.current;
      const wrap = wrapRef.current;
      if (!shell || !wrap) return;
      const width = shell.clientWidth || 1;
      const height = shell.clientHeight || 1;
      const percentX = clamp((100 / width) * x);
      const percentY = clamp((100 / height) * y);
      const centerX = percentX - 50;
      const centerY = percentY - 50;

      const properties: Record<string, string> = {
        '--pointer-x': `${percentX}%`,
        '--pointer-y': `${percentY}%`,
        '--background-x': `${adjust(percentX, 0, 100, 35, 65)}%`,
        '--background-y': `${adjust(percentY, 0, 100, 35, 65)}%`,
        '--pointer-from-center': `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
        '--pointer-from-top': `${percentY / 100}`,
        '--pointer-from-left': `${percentX / 100}`,
        '--rotate-x': `${round(-(centerX / 5))}deg`,
        '--rotate-y': `${round(centerY / 4)}deg`
      };
      for (const [k, v] of Object.entries(properties)) wrap.style.setProperty(k, v);
    };

    const step = (ts: number) => {
      if (!running) return;
      if (lastTs === 0) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const tau = ts < initialUntil ? INITIAL_TAU : DEFAULT_TAU;
      const k = 1 - Math.exp(-dt / tau);
      currentX += (targetX - currentX) * k;
      currentY += (targetY - currentY) * k;
      setVarsFromXY(currentX, currentY);
      const stillFar = Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05;
      if (stillFar || document.hasFocus()) rafId = requestAnimationFrame(step);
      else { running = false; lastTs = 0; }
    };

    return {
      setImmediate(x: number, y: number) { currentX = x; currentY = y; setVarsFromXY(x, y); },
      setTarget(x: number, y: number) { targetX = x; targetY = y; if (!running) { running = true; lastTs = 0; rafId = requestAnimationFrame(step); } },
      toCenter() { if (shellRef.current) this.setTarget(shellRef.current.clientWidth / 2, shellRef.current.clientHeight / 2); },
      beginInitial(durationMs: number) { initialUntil = performance.now() + durationMs; if (!running) { running = true; lastTs = 0; rafId = requestAnimationFrame(step); } },
      getCurrent() { return { x: currentX, y: currentY, tx: targetX, ty: targetY }; },
      cancel() { if (rafId) cancelAnimationFrame(rafId); running = false; }
    };
  }, [enableTilt]);

  useEffect(() => {
    if (!enableTilt || !tiltEngine || !shellRef.current) return;
    const shell = shellRef.current;
    
    const onMove = (e: PointerEvent) => {
      const rect = shell.getBoundingClientRect();
      tiltEngine.setTarget(e.clientX - rect.left, e.clientY - rect.top);
    };

    const onEnter = (e: PointerEvent) => {
      shell.classList.add('active', 'entering');
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = window.setTimeout(() => shell.classList.remove('entering'), 180);
      onMove(e);
    };

    const onLeave = () => {
      tiltEngine.toCenter();
      const checkSettle = () => {
        const { x, y, tx, ty } = tiltEngine.getCurrent();
        if (Math.hypot(tx - x, ty - y) < 0.6) shell.classList.remove('active');
        else leaveRafRef.current = requestAnimationFrame(checkSettle);
      };
      leaveRafRef.current = requestAnimationFrame(checkSettle);
    };

    shell.addEventListener('pointerenter', onEnter);
    shell.addEventListener('pointermove', onMove);
    shell.addEventListener('pointerleave', onLeave);
    
    tiltEngine.setImmediate(shell.clientWidth - 70, 60);
    tiltEngine.toCenter();
    tiltEngine.beginInitial(1200);

    return () => {
      shell.removeEventListener('pointerenter', onEnter);
      shell.removeEventListener('pointermove', onMove);
      shell.removeEventListener('pointerleave', onLeave);
      tiltEngine.cancel();
    };
  }, [enableTilt, tiltEngine]);

  return (
    <div ref={wrapRef} className={`pc-card-wrapper font-['Lexend'] ${className}`} style={{
      '--icon': `url(${iconUrl})`,
      '--grain': `url(${grainUrl})`,
      '--inner-gradient': innerGradient ?? DEFAULT_INNER_GRADIENT,
      '--behind-glow-color': behindGlowColor ?? 'rgba(251, 113, 133, 0.4)', // Thematic Rose-400
      '--behind-glow-size': behindGlowSize ?? '60%'
    } as any}>
      {behindGlowEnabled && <div className="pc-behind" />}
      <div ref={shellRef} className="pc-card-shell">
        <section className="pc-card">
          <div className="pc-inside">
            <div className="pc-shine" />
            <div className="pc-glare" />
            <div className="pc-content pc-avatar-content">
              <img className="avatar" src={avatarUrl} alt={name} />
              {showUserInfo && (
                <div className="pc-user-info">
                  <div className="pc-user-details">
                    <div className="pc-mini-avatar">
                      <img src={miniAvatarUrl || avatarUrl} alt={name} />
                    </div>
                    <div className="pc-user-text">
                      <div className="pc-handle">@{handle}</div>
                      <div className="pc-status">{status}</div>
                    </div>
                  </div>
                  <button className="pc-contact-btn" onClick={onContactClick} type="button">
                    {contactText}
                  </button>
                </div>
              )}
            </div>
            <div className="pc-content">
              <div className="pc-details">
                <h3>{name}</h3>
                <p>{title}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default React.memo(ProfileCardComponent);