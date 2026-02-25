import * as React from '@theia/core/shared/react';

/**
 * OpenSpace Mascot - Animated Platypus
 * Idle animation with blinking, tail wagging, and finger tapping
 */

interface MascotAnimatorProps {
  size?: number;
  className?: string;
}

export const MascotAnimator: React.FC<MascotAnimatorProps> = ({ 
  size = 120, 
  className = '' 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      className={`mascot-animator ${className}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5B041" />
          <stop offset="100%" stopColor="#E67E22" />
        </linearGradient>
        <linearGradient id="bodyHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F8C471" />
          <stop offset="50%" stopColor="#F5B041" />
        </linearGradient>
        <linearGradient id="billGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5D6D7E" />
          <stop offset="100%" stopColor="#2C3E50" />
        </linearGradient>
        <linearGradient id="headsetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#BDC3C7" />
          <stop offset="100%" stopColor="#7F8C8D" />
        </linearGradient>
        <linearGradient id="visorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="50%" stopColor="#0099CC" />
          <stop offset="100%" stopColor="#006699" />
        </linearGradient>
        <linearGradient id="jacketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34495E" />
          <stop offset="100%" stopColor="#2C3E50" />
        </linearGradient>
        <linearGradient id="tabletScreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#00B8D4" />
        </linearGradient>
        <linearGradient id="thinkingShimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        
        {/* Shimmer animation */}
        <linearGradient id="shimmerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0, 212, 255, 0)" />
          <stop offset="50%" stopColor="rgba(0, 212, 255, 0.8)" />
          <stop offset="100%" stopColor="rgba(0, 212, 255, 0)" />
        </linearGradient>
      </defs>
      
      {/* Tail - animated wagging */}
      <g className="mascot-tail">
        <ellipse 
          cx="160" cy="140" 
          rx="25" ry="35" 
          fill="#2C3E50"
          style={{ transformOrigin: '145px 130px' }}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-5 145 130; 5 145 130; -5 145 130"
            dur="2s"
            repeatCount="indefinite"
          />
        </ellipse>
        {/* Tail segments for texture */}
        <ellipse cx="160" cy="125" rx="20" ry="8" fill="#34495E" opacity="0.5">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-5 145 130; 5 145 130; -5 145 130"
            dur="2s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="162" cy="140" rx="18" ry="7" fill="#34495E" opacity="0.5">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-5 145 130; 5 145 130; -5 145 130"
            dur="2s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="158" cy="155" rx="16" ry="6" fill="#34495E" opacity="0.5">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-5 145 130; 5 145 130; -5 145 130"
            dur="2s"
            repeatCount="indefinite"
          />
        </ellipse>
      </g>
      
      {/* Body */}
      <ellipse cx="100" cy="130" rx="45" ry="40" fill="url(#bodyGrad)" />
      <ellipse cx="100" cy="125" rx="35" ry="30" fill="url(#bodyHighlight)" opacity="0.6" />
      
      {/* Jacket */}
      <path 
        d="M65 115 Q60 145 70 160 L95 165 L105 165 L130 160 Q140 145 135 115 Q120 125 100 125 Q80 125 65 115"
        fill="url(#jacketGrad)"
      />
      
      {/* Jacket collar */}
      <path 
        d="M75 115 L100 130 L125 115 L120 110 L100 120 L80 110 Z"
        fill="#2C3E50"
      />
      
      {/* Tablet */}
      <g className="mascot-tablet">
        <rect x="55" y="135" width="50" height="35" rx="3" fill="#1A252F" />
        <rect x="58" y="138" width="44" height="29" rx="2" fill="url(#tabletScreen)" />
        {/* Code lines on tablet */}
        <rect x="62" y="142" width="20" height="2" rx="1" fill="rgba(255,255,255,0.7)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" />
        </rect>
        <rect x="62" y="147" width="30" height="2" rx="1" fill="rgba(255,255,255,0.5)">
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="1.5s" repeatCount="indefinite" begin="0.2s" />
        </rect>
        <rect x="62" y="152" width="25" height="2" rx="1" fill="rgba(255,255,255,0.5)">
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="1.5s" repeatCount="indefinite" begin="0.4s" />
        </rect>
        <rect x="62" y="157" width="15" height="2" rx="1" fill="rgba(255,255,255,0.7)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" begin="0.6s" />
        </rect>
      </g>
      
      {/* Left arm (static) */}
      <ellipse cx="55" cy="135" rx="12" ry="18" fill="#E67E22" />
      <ellipse cx="52" cy="145" rx="8" ry="10" fill="#D35400" />
      
      {/* Right arm - tapping animation */}
      <g className="mascot-right-arm">
        <ellipse cx="145" cy="130" rx="12" ry="18" fill="#E67E22">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -3; 0 0"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </ellipse>
        {/* Finger/hand */}
        <ellipse cx="148" cy="140" rx="6" ry="8" fill="#D35400">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -3; 0 0"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </ellipse>
      </g>
      
      {/* Head */}
      <ellipse cx="100" cy="75" rx="48" ry="42" fill="url(#bodyGrad)" />
      <ellipse cx="100" cy="70" rx="38" ry="32" fill="url(#bodyHighlight)" opacity="0.5" />
      
      {/* Headset band */}
      <path 
        d="M52 75 Q52 35 100 35 Q148 35 148 75"
        fill="none"
        stroke="url(#headsetGrad)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      
      {/* Headset ear cups */}
      <rect x="42" y="60" width="16" height="30" rx="6" fill="url(#headsetGrad)" stroke="#5D6D7E" strokeWidth="2" />
      <rect x="142" y="60" width="16" height="30" rx="6" fill="url(#headsetGrad)" stroke="#5D6D7E" strokeWidth="2" />
      
      {/* Ear cup inner detail */}
      <circle cx="50" cy="75" r="5" fill="#7F8C8D" />
      <circle cx="150" cy="75" r="5" fill="#7F8C8D" />
      
      {/* Visor/Glasses */}
      <path 
        d="M65 70 L135 70 L135 88 Q135 92 130 92 L100 92 L70 92 Q65 92 65 88 Z"
        fill="url(#visorGrad)"
        stroke="#00A8E8"
        strokeWidth="2"
      />
      
      {/* Visor frame */}
      <path 
        d="M62 68 L138 68 L138 90 Q138 95 132 95 L100 95 L68 95 Q62 95 62 90 Z"
        fill="none"
        stroke="#2C3E50"
        strokeWidth="3"
      />
      
      {/* Visor bridge */}
      <rect x="98" y="68" width="4" height="12" fill="#2C3E50" />
      
      {/* Visor shine */}
      <path 
        d="M70 72 L85 72 L80 82 L68 82 Z"
        fill="rgba(255,255,255,0.4)"
      >
        <animate
          attributeName="opacity"
          values="0.4;0.7;0.4"
          dur="3s"
          repeatCount="indefinite"
        />
      </path>
      <path 
        d="M115 72 L130 72 L125 82 L113 82 Z"
        fill="rgba(255,255,255,0.3)"
      >
        <animate
          attributeName="opacity"
          values="0.3;0.6;0.3"
          dur="3s"
          repeatCount="indefinite"
          begin="1.5s"
        />
      </path>
      
      {/* Hidden eyes (behind visor) - with blinking animation */}
      <g className="mascot-eyes">
        <ellipse cx="85" cy="80" rx="8" ry="6" fill="#2C3E50">
          <animate
            attributeName="ry"
            values="6;0.5;6"
            keyTimes="0;0.05;0.1"
            dur="4s"
            repeatCount="indefinite"
            begin="0.5s"
          />
        </ellipse>
        <ellipse cx="115" cy="80" rx="8" ry="6" fill="#2C3E50">
          <animate
            attributeName="ry"
            values="6;0.5;6"
            keyTimes="0;0.05;0.1"
            dur="4s"
            repeatCount="indefinite"
            begin="0.5s"
          />
        </ellipse>
        {/* Eye highlights */}
        <circle cx="87" cy="78" r="2" fill="white" opacity="0.8">
          <animate
            attributeName="opacity"
            values="0.8;0;0.8"
            keyTimes="0;0.05;0.1"
            dur="4s"
            repeatCount="indefinite"
            begin="0.5s"
          />
        </circle>
        <circle cx="117" cy="78" r="2" fill="white" opacity="0.8">
          <animate
            attributeName="opacity"
            values="0.8;0;0.8"
            keyTimes="0;0.05;0.1"
            dur="4s"
            repeatCount="indefinite"
            begin="0.5s"
          />
        </circle>
      </g>
      
      {/* Bill */}
      <ellipse cx="100" cy="105" rx="22" ry="14" fill="url(#billGrad)" />
      <ellipse cx="100" cy="103" rx="18" ry="8" fill="#5D6D7E" opacity="0.5" />
      
      {/* Bill nostrils */}
      <ellipse cx="94" cy="103" rx="3" ry="2" fill="#1A252F" />
      <ellipse cx="106" cy="103" rx="3" ry="2" fill="#1A252F" />
      
      {/* Shimmer effect overlay for thinking state */}
      <g className="mascot-shimmer" opacity="0">
        <rect x="50" y="30" width="100" height="140" fill="url(#shimmerGrad)" opacity="0.3">
          <animateTransform
            attributeName="transform"
            type="translate"
            from="-100 0"
            to="100 0"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
      </g>
      
      {/* Thinking dots (subtle breathing) */}
      <g className="thinking-dots" opacity="0.6">
        <circle cx="70" cy="165" r="3" fill="#00D4FF">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="80" cy="168" r="3" fill="#00D4FF">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
          <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
        </circle>
        <circle cx="90" cy="165" r="3" fill="#00D4FF">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.8s" />
          <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" begin="0.8s" />
        </circle>
      </g>
    </svg>
  );
};

/**
 * Compact version for chat widget overlay
 */
export const MascotAnimatorCompact: React.FC<MascotAnimatorProps> = ({ 
  size = 80, 
  className = '' 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      className={`mascot-animator-compact ${className}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5B041" />
          <stop offset="100%" stopColor="#E67E22" />
        </linearGradient>
        <linearGradient id="billGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5D6D7E" />
          <stop offset="100%" stopColor="#2C3E50" />
        </linearGradient>
        <linearGradient id="headsetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#BDC3C7" />
          <stop offset="100%" stopColor="#7F8C8D" />
        </linearGradient>
        <linearGradient id="visorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="50%" stopColor="#0099CC" />
          <stop offset="100%" stopColor="#006699" />
        </linearGradient>
        <linearGradient id="jacketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34495E" />
          <stop offset="100%" stopColor="#2C3E50" />
        </linearGradient>
        <linearGradient id="tabletScreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#00B8D4" />
        </linearGradient>
      </defs>
      
      {/* Simplified tail */}
      <ellipse cx="160" cy="140" rx="25" ry="35" fill="#2C3E50">
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-5 145 130; 5 145 130; -5 145 130"
          dur="2s"
          repeatCount="indefinite"
        />
      </ellipse>
      
      {/* Body */}
      <ellipse cx="100" cy="130" rx="45" ry="40" fill="url(#bodyGrad)" />
      
      {/* Jacket */}
      <path 
        d="M65 115 Q60 145 70 160 L95 165 L105 165 L130 160 Q140 145 135 115 Q120 125 100 125 Q80 125 65 115"
        fill="url(#jacketGrad)"
      />
      
      {/* Tablet */}
      <rect x="55" y="135" width="50" height="35" rx="3" fill="#1A252F" />
      <rect x="58" y="138" width="44" height="29" rx="2" fill="url(#tabletScreen)" />
      
      {/* Head */}
      <ellipse cx="100" cy="75" rx="48" ry="42" fill="url(#bodyGrad)" />
      
      {/* Headset */}
      <path 
        d="M52 75 Q52 35 100 35 Q148 35 148 75"
        fill="none"
        stroke="url(#headsetGrad)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect x="42" y="60" width="16" height="30" rx="6" fill="url(#headsetGrad)" stroke="#5D6D7E" strokeWidth="2" />
      <rect x="142" y="60" width="16" height="30" rx="6" fill="url(#headsetGrad)" stroke="#5D6D7E" strokeWidth="2" />
      
      {/* Visor */}
      <path 
        d="M65 70 L135 70 L135 88 Q135 92 130 92 L100 92 L70 92 Q65 92 65 88 Z"
        fill="url(#visorGrad)"
        stroke="#00A8E8"
        strokeWidth="2"
      />
      <path 
        d="M62 68 L138 68 L138 90 Q138 95 132 95 L100 95 L68 95 Q62 95 62 90 Z"
        fill="none"
        stroke="#2C3E50"
        strokeWidth="3"
      />
      
      {/* Blinking eyes */}
      <ellipse cx="85" cy="80" rx="8" ry="6" fill="#2C3E50">
        <animate
          attributeName="ry"
          values="6;0.5;6"
          keyTimes="0;0.05;0.1"
          dur="4s"
          repeatCount="indefinite"
        />
      </ellipse>
      <ellipse cx="115" cy="80" rx="8" ry="6" fill="#2C3E50">
        <animate
          attributeName="ry"
          values="6;0.5;6"
          keyTimes="0;0.05;0.1"
          dur="4s"
          repeatCount="indefinite"
        />
      </ellipse>
      
      {/* Bill */}
      <ellipse cx="100" cy="105" rx="22" ry="14" fill="url(#billGrad)" />
      <ellipse cx="94" cy="103" rx="3" ry="2" fill="#1A252F" />
      <ellipse cx="106" cy="103" rx="3" ry="2" fill="#1A252F" />
      
      {/* Thinking indicator dots */}
      <circle cx="75" cy="165" r="3" fill="#00D4FF">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="85" cy="168" r="3" fill="#00D4FF">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
      </circle>
      <circle cx="95" cy="165" r="3" fill="#00D4FF">
        <animate attributeName="values" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.8s" />
      </circle>
    </svg>
  );
};

export default MascotAnimator;
