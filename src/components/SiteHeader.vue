<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CATEGORIES } from '../../shared/categories'
import '../../.shared-design/tokens.css'
import '../../.shared-design/navigation.css'

const homeUrl = location.hostname === 'shared-design.gallery.annouimo.com'
  ? 'https://shared-design.www.annouimo.com/'
  : 'https://www.annouimo.com/'
</script>

<template>
  <header class="header ann-topbar">
    <div class="ann-site-identity">
      <a :href="homeUrl" aria-label="Annouimo 的个人主页">Annouimo</a>
      <span aria-hidden="true">›</span>
      <RouterLink to="/">书与影</RouterLink>
    </div>
    <nav class="ann-topbar-nav" aria-label="站内导航">
      <RouterLink v-for="category in CATEGORIES" :key="category.slug" :to="category.path">
        {{ category.label }}
      </RouterLink>
    </nav>
  </header>
</template>
