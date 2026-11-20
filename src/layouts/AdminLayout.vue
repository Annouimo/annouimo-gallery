<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import AdminToast from '../components/AdminToast.vue'

const route = useRoute()
</script>

<template>
  <AdminHeader :class="{ 'home-width': route.name === 'admin-home' }" />
  <main class="admin-main" :class="{ 'home-width': route.name === 'admin-home' }">
    <RouterView />
  </main>
  <footer class="admin-footer">Annouimo 的陈列室 · 管理</footer>
  <AdminToast />
</template>

<style scoped>
.home-width {
  --admin-content-width: 52rem;
}

.admin-main {
  flex: 1;
  width: 100%;
  max-width: calc(var(--admin-content-width, 1200px) + var(--gap) * 2);
  margin: auto;
  padding: var(--gap);
}

.admin-footer {
  max-width: calc(1200px + var(--gap) * 2);
  margin: auto;
  padding: 0 var(--gap) 2rem;
  font-size: 12px;
  color: var(--secondary);
  text-align: right;
}

@media (max-width: 768px) {
  .admin-footer {
    padding-bottom: 1.5rem;
  }
}
</style>
