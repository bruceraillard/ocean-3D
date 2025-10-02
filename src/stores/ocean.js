import {defineStore} from 'pinia'
import {fetchFishRecords, uniqueValues} from '../services/fishApi.js'

export const useOceanStore = defineStore('ocean', {
    state: () => ({
        rows: [],
        filteredRows: [],
        loading: false,
        error: null,
        // Filtres par défaut = ceux de ta requête initiale
        filters: {
            campagne: '2024',
            site: 'Ouegoa',
            station: null,
            transect: null,
            type_poissons: null,
            q: '',
        },
        options: {campagnes: [], sites: [], stations: [], transects: [], types: []},
        selected: null,
        recenterTick: 0,
    }),

    actions: {
        async loadData() {
            if (this.loading) return
            this.loading = true;
            this.error = null
            try {
                // 1) première page (augmentable si besoin)
                const {campagne, site, station, transect, type_poissons, q} = this.filters
                const {results} = await fetchFishRecords({
                    limit: 200, campagne, site, station, transect, type_poissons, q
                })
                this.rows = results

                // 2) options dynamiques depuis ce jeu
                this.options.campagnes = uniqueValues(this.rows, 'campagne')
                this.options.sites = uniqueValues(this.rows, 'site')
                this.options.stations = uniqueValues(this.rows, 'station')
                this.options.transects = uniqueValues(this.rows, 'transect')
                this.options.types = uniqueValues(this.rows, 'type_poissons')

                // 3) applique filtres côté front (utile si tu ajoutes d’autres critères)
                this.applyFilters({})
            } catch (e) {
                this.error = e?.message || String(e)
            } finally {
                this.loading = false
            }
        },

        async applyFilters(next = {}) {
            // On refait l’appel API quand un refine change
            this.filters = {...this.filters, ...next}
            await this.loadData() // recharge depuis l'API avec les refine à jour
            this.filteredRows = this.rows.slice(0, 50) // cap d’affichage (perf)
            if (this.selected && !this.filteredRows.includes(this.selected)) this.selected = null
        },

        select(row) {
            this.selected = row
        },
        triggerRecenter() {
            this.recenterTick++
        },
    }
})
