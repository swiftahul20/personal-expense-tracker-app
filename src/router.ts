import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "./stores/auth";
import AuthView from "./views/AuthView.vue";
import HomeView from "./views/HomeView.vue";
import InsightsView from "./views/InsightsView.vue";
import ProfileView from "./views/ProfileView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: AuthView,
      props: { mode: "login" },
    },
    {
      path: "/register",
      name: "register",
      component: AuthView,
      props: { mode: "register" },
    },
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: "/insights",
      name: "insights",
      component: InsightsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/profile",
      name: "profile",
      component: ProfileView,
      meta: { requiresAuth: true },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.bootstrap();
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: "login" };
  if ((to.name === "login" || to.name === "register") && auth.isAuthenticated)
    return { name: "home" };
});

export default router;
