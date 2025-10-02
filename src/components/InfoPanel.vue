<template>
  <div class="panel">
    <h2>Poisson sélectionné</h2>

    <template v-if="sel">
      <ul class="mini">
        <li><strong>Campagne</strong> : {{ sel.campagne }}</li>
        <li><strong>Site</strong> : {{ sel.site }}</li>
        <li><strong>Station</strong> : {{ sel.station }}</li>
        <li><strong>Transect</strong> : {{ sel.transect }}</li>
        <li><strong>Type</strong> : {{ sel.type_poissons }}</li>
        <li><strong>Description</strong> : {{ sel.description }}</li>
        <li><strong>Nom latin</strong> : {{ sel.nom_latin }}</li>
        <li><strong>Décompte</strong> : {{ sel.decompte }}</li>
      </ul>
    </template>

    <p v-else class="muted">Cliquez sur un thon pour afficher les informations liées.</p>
  </div>
</template>

<script setup>
import {computed} from 'vue'
import {useOceanStore} from '../stores/ocean.js'

const ocean = useOceanStore()
const sel = computed(() => ocean.selected)
</script>
