<script setup lang="ts">
import { RouterView } from 'vue-router'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
</script>

<template>
  <div class="public-layout">
    <SiteHeader />
    <main class="main">
      <RouterView />
    </main>
    <SiteFooter />
  </div>
</template>

<style>
.public-layout {
  display: flex;
  flex: 1;
  flex-direction: column;
  color: var(--primary);
  background: var(--theme);
  --theme: var(--ann-canvas);
  --background: #faf9f5;
  --entry: #faf9f5;
  --primary: var(--ann-text);
  --secondary: var(--ann-muted);
  --tertiary: var(--ann-hover);
  --content: var(--ann-text);
  --border: var(--ann-border);
  --ink: var(--ann-accent);
}
@media (prefers-color-scheme: dark) {
  .public-layout {
    --theme: var(--ann-canvas);
    --background: #292a25;
    --entry: #292a25;
    --primary: var(--ann-text);
    --secondary: var(--ann-muted);
    --tertiary: var(--ann-hover);
    --content: var(--ann-text);
    --border: var(--ann-border);
    --ink: var(--ann-accent);
  }
}
.public-layout .page-title,
.public-layout .work-title {
  font-size: clamp(30px, 6vw, 40px);
  line-height: 1.25;
}
.public-layout a:focus-visible,
.public-layout button:focus-visible,
.public-layout input:focus-visible { outline-color: var(--ink); }
@media (max-width: 768px) {
  .public-layout { --gap: 20px; }
}
</style>
