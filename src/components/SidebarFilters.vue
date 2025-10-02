<template>
  <div class="filters">
    <h2>Filtres</h2>

    <label class="field">
      <span>Campagne</span>
      <select v-model="campagne">
        <option :value="null">Toutes</option>
        <option v-for="v in ocean.options.campagnes" :key="v" :value="v">{{ v }}</option>
      </select>
    </label>

    <label class="field">
      <span>Site</span>
      <select v-model="site">
        <option :value="null">Tous</option>
        <option v-for="v in ocean.options.sites" :key="v" :value="v">{{ v }}</option>
      </select>
    </label>

    <label class="field">
      <span>Station</span>
      <select v-model="station">
        <option :value="null">Toutes</option>
        <option v-for="v in ocean.options.stations" :key="v" :value="v">{{ v }}</option>
      </select>
    </label>

    <label class="field">
      <span>Transect</span>
      <select v-model="transect">
        <option :value="null">Tous</option>
        <option v-for="v in ocean.options.transects" :key="v" :value="v">{{ v }}</option>
      </select>
    </label>

    <label class="field">
      <span>Type de poissons</span>
      <select v-model="type_poissons">
        <option :value="null">Tous</option>
        <option v-for="v in ocean.options.types" :key="v" :value="v">{{ v }}</option>
      </select>
    </label>

    <button class="apply" @click="apply">Appliquer</button>
  </div>
</template>

<script setup>
import {ref, watchEffect} from 'vue'
import {useOceanStore} from '../stores/ocean.js'

const ocean = useOceanStore()

const campagne = ref(ocean.filters.campagne)
const site = ref(ocean.filters.site)
const station = ref(ocean.filters.station)
const transect = ref(ocean.filters.transect)
const type_poissons = ref(ocean.filters.type_poissons)

async function apply() {
  await ocean.applyFilters({
    campagne: campagne.value || null,
    site: site.value || null,
    station: station.value || null,
    transect: transect.value || null,
    type_poissons: type_poissons.value || null,
  })
}

// Quand les options changent (après chargement), si la valeur choisie n’existe plus → reset
watchEffect(() => {
  if (ocean.options.sites.length && site.value && !ocean.options.sites.includes(site.value)) site.value = null
})
</script>
