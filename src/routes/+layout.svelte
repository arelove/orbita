<script lang="ts">
  import '../app.css';
  import TitleBar from '$lib/components/TitleBar.svelte';
  import Splash from '$lib/components/Splash.svelte';
  import { onMount } from 'svelte';
  import { platform } from '@tauri-apps/plugin-os';
  import { osMul, osPlatform } from '$lib/stores';
  import { fade } from 'svelte/transition';

  let ready = $state(false);
  let { children } = $props();
  let isLinux = $state(false);

  async function getOsType(): Promise<string> {
    return await platform();
  }

  onMount(async () => {
    setTimeout(() => ready = true, 1800);
    try {
      const plf = await getOsType();
      osPlatform.set(plf);
      isLinux = plf === 'linux';
      osMul.set(plf === 'windows' ? 1024 : 1000);
    } catch (e) {
      console.error('Failed to get platform info:', e);
    }
  });
</script>

{#if !ready}
  <div out:fade={{ duration: 500 }}>
    <Splash />
  </div>
{:else}
  <div class="flex flex-col min-h-screen app-shell {isLinux ? 'linux-bg' : ''}" in:fade={{ duration: 300 }}>
    <TitleBar />
    <main class="flex-1 flex flex-col overflow-hidden">
      {@render children()}
    </main>
  </div>
{/if}