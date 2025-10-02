<template>
  <header class="topbar">
    <div class="brand"><span class="dot"></span> Banc de thons – Exploration</div>
    <div class="actions">
      <input
          class="search"
          type="search"
          placeholder="Rechercher (description/latin)…"
          v-model="q"
          @input="debouncedSearch"
      />
      <button class="btn" @click="recenter">Recentrer</button>
    </div>
  </header>
</template>

<script setup>
import {ref} from 'vue'
import {useOceanStore} from '../stores/ocean.js'

const ocean = useOceanStore()
const q = ref(ocean.filters.q || '')
let t = null

function debouncedSearch() {
  clearTimeout(t)
  t = setTimeout(() => {
    ocean.applyFilters({q: q.value || ''})
  }, 350)
}

function recenter() {
  ocean.triggerRecenter()
}
</script>
