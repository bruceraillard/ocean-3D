import {createRouter, createWebHistory} from 'vue-router'
import Home from '../src/views/Home.vue'

const routes = [
    {path: '/', name: 'home', component: Home},
]

export default createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior: () => ({top: 0}),
})
