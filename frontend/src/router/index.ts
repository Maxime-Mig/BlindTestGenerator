import { createRouter, createWebHistory } from 'vue-router'
import SelectionPage from '../components/SelectionPage.vue'
import GameInterface from '../components/GameInterface.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: SelectionPage
        },
        {
            path: '/game',
            name: 'game',
            component: GameInterface,
            props: route => ({
                filters: route.query.filters ? JSON.parse(route.query.filters as string) : { types: [], difficulties: [] }
            })
        }
    ]
})

export default router
