<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CATEGORIES } from '../../shared/categories'
import SiteSearch from './SiteSearch.vue'
</script>

<template>
  <header class="header">
    <nav class="header-nav" aria-label="主导航">
      <div class="logo">
        <RouterLink class="logo-link" to="/">书与影</RouterLink>
      </div>

      <div class="nav-right">
        <ul class="menu">
          <li v-for="category in CATEGORIES" :key="category.slug">
            <RouterLink :to="category.path" exact-active-class="active">
              {{ category.label }}
            </RouterLink>
          </li>
          <li><a class="home-link" href="https://annouimo.com/">个人主页</a></li>
        </ul>
        <SiteSearch />
      </div>
    </nav>
  </header>
</template>

<style scoped>
.nav-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  column-gap: var(--gap);
}
.home-link { color: var(--ink); }
@media (max-width: 520px) {
  .header-nav { padding-block: 14px; row-gap: 8px; }
  .nav-right { justify-content: space-between; width: 100%; column-gap: 12px; }
  .menu { flex: 1; gap: 14px; }
}
</style>
