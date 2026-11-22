import { mount } from 'svelte';
import './styles/fonts.css';
import './styles/global.css';
import App from './App.svelte';
import { workspace } from '$lib/state/workspace.svelte';
import { pwa } from '$lib/services/pwa.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('No se encontró el contenedor #app.');

workspace.initNavigation();
pwa.init();

export default mount(App, { target });
