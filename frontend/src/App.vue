<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <!-- Full-bleed background -->
  <div class="relative min-h-screen font-sans overflow-hidden text-white select-none bg-[#0d0d1a]">
    <!-- Background image -->
    <div class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.85]"
         style="background-image: url('/bg.png');"></div>
    <!-- Gradient vignette -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_50%,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.65)_100%)]"></div>

    <RouterView />
  </div>
</template>
