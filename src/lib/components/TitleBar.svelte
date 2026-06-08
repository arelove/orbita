<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { platform } from '@tauri-apps/plugin-os';
  import { onMount, onDestroy } from 'svelte';
  import { scanParams } from '$lib/stores';

  let plf = $state('');
  let isMaximized = $state(false);

  const params = $derived($scanParams);
  const win = getCurrentWindow();

  // FIX TS2345: onMount не может возвращать Promise<() => void> напрямую —
  // Svelte ожидает синхронный деструктор. Храним unlisten отдельно.
  let unlistenResize: (() => void) | null = null;

  onMount(() => {
    (async () => {
      plf = await platform();
      isMaximized = await win.isMaximized().catch(() => false);
      unlistenResize = await win.onResized(async () => {
        isMaximized = await win.isMaximized().catch(() => false);
      });
    })();
  });

  onDestroy(() => {
    unlistenResize?.();
  });

  async function closeWindow()    { await win.close(); }
  async function minimizeWindow() { await win.minimize(); }
  async function toggleMaximize() {
    if (isMaximized) { await win.unmaximize(); } else { await win.maximize(); }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-tauri-drag-region
  class="titlebar flex h-11 items-center justify-between px-3 select-none shrink-0"
>
  <!-- Левая сторона -->
  {#if plf === 'macos'}
    <div class="flex items-center gap-2 z-10">
      <button
        onclick={closeWindow}
        class="traffic-btn close w-3 h-3 rounded-full flex items-center justify-center group"
        title="Close" aria-label="Close window"
      >
        <svg class="w-1.5 h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 6 6">
          <path d="M1 1l4 4M5 1L1 5" stroke="#7d1a1a" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
      <button onclick={minimizeWindow} class="traffic-btn minimize w-3 h-3 rounded-full" title="Minimize" aria-label="Minimize window"></button>
      <button onclick={toggleMaximize} class="traffic-btn maximize w-3 h-3 rounded-full" title="Maximize" aria-label="Maximize window"></button>
    </div>
  {:else}
    <!-- Windows/Linux — логотип + название -->
    <div class="app-brand flex items-center gap-2 pointer-events-none z-10">
      <div class="brand-icon">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" fill="#0e1018" stroke="#3b82f6" stroke-width="0.8"/>
          <circle cx="12" cy="12" r="6.5" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="3.5 2.8" stroke-dashoffset="1"/>
          <circle cx="12" cy="12" r="3.5" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="2.5 2"/>
          <circle cx="12" cy="12" r="1.5" fill="#3b82f6"/>
        </svg>
      </div>
      <span class="brand-name text-sm font-semibold">Orbita</span>
    </div>
  {/if}

  <!-- Центр: навигация -->
  <nav class="breadcrumb-nav absolute left-1/2 -translate-x-1/2" aria-label="Navigation">
    <ol class="flex items-center gap-1.5">
      <li>
        <button
          onclick={() => goto('/')}
          class="nav-btn text-xs px-2.5 py-1 rounded-full transition-all
                 {$page.url.pathname === '/' ? 'nav-btn-active' : 'nav-btn-idle'}"
        >
          Disks
        </button>
      </li>

      {#if $page.url.pathname.startsWith('/disk')}
        <li class="flex items-center text-white/20" aria-hidden="true">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </li>
        <li>
          {#if params?.disk}
            <span class="flex items-center gap-1 text-xs text-white/50 max-w-40 truncate" title={params.disk}>
              {#if params.isDirectory}
                <img src="/fileicons/default_folder.svg" class="w-3.5 h-3.5 shrink-0 opacity-70" alt="" aria-hidden="true" />
              {:else}
                <img src="/fileicons/default_root_folder.svg" class="w-3.5 h-3.5 shrink-0 opacity-70" alt="" aria-hidden="true" />
              {/if}
              {params.disk.split('/').at(-1) || params.disk}
            </span>
          {:else}
            <span class="text-xs text-white/30">Scanning…</span>
          {/if}
        </li>
      {/if}

      {#if $page.url.pathname.startsWith('/history')}
        <li class="flex items-center text-white/20" aria-hidden="true">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </li>
        <li><span class="text-xs text-white/50">History</span></li>
      {/if}
    </ol>
  </nav>

  <!-- Правая сторона: Windows/Linux -->
  {#if plf !== 'macos'}
    <div class="flex items-center gap-0.5 z-10">
      <button
        onclick={minimizeWindow}
        class="win-btn flex items-center justify-center w-8 h-7 rounded-md transition-all hover:bg-white/10"
        title="Minimize" aria-label="Minimize window"
      >
        <svg class="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" d="M5 12h14"/>
        </svg>
      </button>

      <button
        onclick={toggleMaximize}
        class="win-btn flex items-center justify-center w-8 h-7 rounded-md transition-all hover:bg-white/10"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
      >
        {#if isMaximized}
          <svg class="w-3 h-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="3" y="7" width="14" height="14" rx="1"/>
            <path d="M7 7V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2h-2"/>
          </svg>
        {:else}
          <svg class="w-3 h-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        {/if}
      </button>

      <button
        onclick={closeWindow}
        class="win-btn-close flex items-center justify-center w-8 h-7 rounded-md transition-all hover:bg-red-500/70"
        title="Close" aria-label="Close window"
      >
        <svg class="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {:else}
    <div class="w-20"></div>
  {/if}
</div>

<style>
  .titlebar {
    background: linear-gradient(
      135deg,
      rgba(15, 20, 40, 0.85) 0%,
      rgba(20, 28, 58, 0.80) 100%
    );
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.3);
  }

  .brand-icon {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-name {
    background: linear-gradient(90deg, #a5b4fc, #7dd3fc);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .nav-btn { font-weight: 500; letter-spacing: 0.01em; }

  .nav-btn-active {
    background: rgba(129, 140, 248, 0.2);
    border: 1px solid rgba(129, 140, 248, 0.3);
    color: rgba(165, 180, 252, 1);
  }

  .nav-btn-idle {
    border: 1px solid transparent;
    color: rgba(255, 255, 255, 0.35);
  }

  .nav-btn-idle:hover {
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.08);
  }

  .traffic-btn { transition: filter 0.15s; }
  .traffic-btn:hover { filter: brightness(1.15); }
  .close    { background: #ff5f57; box-shadow: 0 0 0 1px rgba(0,0,0,0.15) inset; }
  .minimize { background: #febc2e; box-shadow: 0 0 0 1px rgba(0,0,0,0.15) inset; }
  .maximize { background: #28c840; box-shadow: 0 0 0 1px rgba(0,0,0,0.15) inset; }
</style>