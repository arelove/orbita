<script lang="ts">
</script>

<div class="splash">
  <div class="disc-wrap">
    <svg class="disc" width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="72" fill="#0e1018"/>
      <circle cx="80" cy="80" r="71" fill="none" stroke="#1e2235" stroke-width="1"/>
      <path d="M80 80 L80 8 A72 72 0 0 1 152 80 Z" fill="#3b82f6" opacity="0.85"/>
      <path d="M80 80 L152 80 A72 72 0 0 1 80 152 Z" fill="#06b6d4" opacity="0.82"/>
      <path d="M80 80 L80 152 A72 72 0 0 1 8 80 Z" fill="#8b5cf6" opacity="0.80"/>
      <path d="M80 80 L8 80 A72 72 0 0 1 80 8 Z" fill="#f59e0b" opacity="0.82"/>
      <circle cx="80" cy="80" r="72" fill="none" stroke="#0e1018" stroke-width="1.5"/>
      <line x1="80" y1="8" x2="80" y2="152" stroke="#0e1018" stroke-width="1.5"/>
      <line x1="8" y1="80" x2="152" y2="80" stroke="#0e1018" stroke-width="1.5"/>
      <path d="M80 80 L130 30 A71 71 0 0 1 130 130 Z" fill="#60a5fa" opacity="0.55"/>
      <path d="M80 80 L130 130 A71 71 0 0 1 30 130 Z" fill="#22d3ee" opacity="0.52"/>
      <path d="M80 80 L30 130 A71 71 0 0 1 30 30 Z" fill="#a78bfa" opacity="0.50"/>
      <path d="M80 80 L30 30 A71 71 0 0 1 130 30 Z" fill="#fbbf24" opacity="0.52"/>
      <circle cx="80" cy="80" r="56" fill="#0e1018"/>
      <path d="M80 80 L80 30 A50 50 0 0 1 130 80 Z" fill="#2563eb" opacity="0.7"/>
      <path d="M80 80 L130 80 A50 50 0 0 1 80 130 Z" fill="#0891b2" opacity="0.68"/>
      <path d="M80 80 L80 130 A50 50 0 0 1 30 80 Z" fill="#7c3aed" opacity="0.66"/>
      <path d="M80 80 L30 80 A50 50 0 0 1 80 30 Z" fill="#d97706" opacity="0.68"/>
      <circle cx="80" cy="80" r="50" fill="none" stroke="#0e1018" stroke-width="1.5"/>
      <line x1="80" y1="30" x2="80" y2="130" stroke="#0e1018" stroke-width="1.5"/>
      <line x1="30" y1="80" x2="130" y2="80" stroke="#0e1018" stroke-width="1.5"/>
      <circle cx="80" cy="80" r="30" fill="#0a0c14"/>
      <circle cx="80" cy="80" r="22" fill="#111420" stroke="#252a3d" stroke-width="1.2"/>
      <circle cx="80" cy="80" r="5" fill="#0a0c14" stroke="#3b82f6" stroke-width="1.2" opacity="0.9"/>
      <circle cx="80" cy="80" r="2.5" fill="#3b82f6"/>
    </svg>
    <svg class="arm" width="160" height="160" viewBox="0 0 160 160">
      <circle cx="128" cy="42" r="8" fill="#141824" stroke="#252a3d" stroke-width="1.2"/>
      <circle cx="128" cy="42" r="4" fill="#0f1220"/>
      <circle cx="128" cy="42" r="1.5" fill="#3b82f6" opacity="0.8"/>
      <path d="M124 50 Q100 72 88 78" fill="none" stroke="#252b44" stroke-width="5" stroke-linecap="round"/>
      <path d="M124 50 Q100 72 88 78" fill="none" stroke="#404a80" stroke-width="2" stroke-linecap="round"/>
      <circle cx="88" cy="78" r="4" fill="#1e2235" stroke="#3b82f6" stroke-width="1.2"/>
      <circle cx="88" cy="78" r="2" fill="#3b82f6"/>
    </svg>
  </div>
  <p class="brand">Orbita</p>
  <div class="dots">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
</div>

<style>
  .splash {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    background: #0a0c14;
    gap: 24px;
  }
  .disc-wrap {
    position: relative;
    width: 160px;
    height: 160px;
  }
  .disc {
    animation: spin 3s linear infinite;
    transform-origin: center;
  }
  .arm {
    position: absolute;
    inset: 0;
    animation: sway 2.4s ease-in-out infinite;
    transform-origin: 80% 26%;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes sway {
    0%, 100% { transform: rotate(-10deg); }
    50%       { transform: rotate(8deg); }
  }
  .brand {
    color: #e2e8f0;
    font-size: 20px;
    font-weight: 300;
    letter-spacing: 6px;
    text-transform: uppercase;
    margin: 0;
  }
  .dots {
    display: flex;
    gap: 6px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    animation: pulse 1.2s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay: .2s; background: #8b5cf6; }
  .dot:nth-child(3) { animation-delay: .4s; background: #06b6d4; }
  @keyframes pulse {
    0%, 100% { opacity: .25; transform: scale(.8); }
    50%       { opacity: 1;   transform: scale(1); }
  }
</style>