const BASE = 'https://data.gouv.nc/api/explore/v2.1/catalog/datasets/rorc_poissons_recifaux/records'

/**
 * Charge des enregistrements depuis data.gouv.nc
 * @param {{
 *   campagne?: string|null,
 *   site?: string|null,
 *   station?: string|null,
 *   transect?: string|number|null,
 *   type_poissons?: string|null,
 *   q?: string|null
 * }} params
 */
export async function fetchFishRecords(params = {}) {
    const {
        campagne = null,
        site = null,
        station = null,
        transect = null,
        type_poissons = null,
        q = null
    } = params

    const qs = new URLSearchParams()
    qs.set('limit', '100')

    if (campagne) qs.append('refine', `campagne:"${campagne}"`)
    if (site) qs.append('refine', `site:"${site}"`)
    if (station) qs.append('refine', `station:"${station}"`)
    if (transect != null) qs.append('refine', `transect:"${transect}"`)
    if (type_poissons) qs.append('refine', `type_poissons:"${type_poissons}"`)
    if (q) qs.set('q', q)

    const url = `${BASE}?${qs.toString()}`
    console.log('➡️ API call:', url) // debug

    const res = await fetch(url, {headers: {accept: 'application/json'}})
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status} ${res.statusText} – ${text}`)
    }
    const json = await res.json()
    return {total: Number(json.total_count || json.total || 0), results: json.results || []}
}

export function uniqueValues(rows, key) {
    const set = new Set()
    rows.forEach(r => {
        if (r[key] != null) set.add(String(r[key]))
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
}
