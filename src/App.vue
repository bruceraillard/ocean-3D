<template>
  <div class="app">
    <TopBar/>
    <main class="main">
      <router-view/>
    </main>
    <footer class="footer">
      <p>Données locales (poissons) · GLB thon animé · Vue 3 + Three.js</p>
    </footer>
  </div>
</template>

<script setup>
import TopBar from './components/TopBar.vue'
</script>
