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
  --theme: #f5f4ed;
  --background: #faf9f5;
  --entry: #faf9f5;
  --primary: #262824;
  --secondary: #595d55;
  --tertiary: #edede3;
  --content: #262824;
  --border: #d8d7cb;
  --ink: #1b365d;
}
@media (prefers-color-scheme: dark) {
  .public-layout {
    --theme: #20211e;
    --background: #292a25;
    --entry: #292a25;
    --primary: #edede2;
    --secondary: #b8b9ad;
    --tertiary: #2b2d27;
    --content: #edede2;
    --border: #41433b;
    --ink: #acc7eb;
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
