<template>
  <div class="home">
    <section class="layout">
      <aside class="sidebar">
        <SidebarFilters/>
        <div class="status">
          <p v-if="ocean.loading">Chargement…</p>
          <p v-else-if="ocean.error" class="error">Erreur : {{ ocean.error }}</p>
          <p v-else>Éléments : {{ ocean.filteredRows.length }}</p>
        </div>
      </aside>

      <section class="canvas">
        <SceneOcean/>
      </section>

      <aside class="panel">
        <InfoPanel/>
      </aside>
    </section>
  </div>
</template>

<script setup>
import {onMounted} from 'vue'
import {useOceanStore} from '../stores/ocean.js'
import SidebarFilters from '../components/SidebarFilters.vue'
import SceneOcean from '../components/SceneOcean.vue'
import InfoPanel from '../components/InfoPanel.vue'

const ocean = useOceanStore()
onMounted(() => {
  ocean.loadData()
})
</script>
