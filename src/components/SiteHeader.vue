<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CATEGORIES } from '../../shared/categories'
import '../../.shared-design/tokens.css'
import '../../.shared-design/navigation.css'
import SiteSearch from './SiteSearch.vue'

const homeUrl = import.meta.env.VITE_HOME_URL || 'https://www.annouimo.com/'
</script>

<template>
  <header class="header">
    <nav class="ann-topbar" aria-label="主导航">
      <a class="ann-home-link" :href="homeUrl">个人主页</a>
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
@media (max-width: 520px) {
  .nav-right { justify-content: space-between; width: 100%; column-gap: 12px; }
  .menu { flex: 1; gap: 14px; }
}
</style>
