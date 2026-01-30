import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import Stats from 'three/addons/libs/stats.module.js';

import { HeartSystem } from './js/HeartSystem.js';
import { BloomManager } from './js/BloomManager.js';
import { GestureHandler } from './js/GestureHandler.js';

// --- CONFIG ---
const config = {
    particleCount: 3000,
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
    baseColor: '#ff0055',
    timeOfDay: 0, // 0-24h
    reset: () => resetSystem()
};

// --- STATE ---
const state = {
    gesture: {
        type: 'IDLE',
        strength: 0,
        rotationY: undefined
    }
};

// --- DOM ---
const loader = document.getElementById('loader');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');

// --- SCENE SETUP ---
let scene, camera, renderer, controls, bloomManager, heartSystem;

try {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.02);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 40);

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const container = document.getElementById('canvas-container');
    if (!container) throw new Error("Canvas container not found");
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.maxDistance = 100;
    controls.minDistance = 10;

    // --- SYSTEMS ---
    bloomManager = new BloomManager(scene, camera, renderer, window.innerWidth, window.innerHeight);
    heartSystem = new HeartSystem(scene, 5000);

    // Set initial count
    heartSystem.setParticleCount(config.particleCount);

} catch (e) {
    console.error("Setup Error:", e);
    if (window.showError) window.showError("Setup Error: " + e.message);
    throw e; // Stop execution
}

// --- GESTURE ---
const gestureHandler = new GestureHandler(
    document.getElementById('webcam'),
    (gestureState) => {
        state.gesture = gestureState;
        updateStatusUI(gestureState);
    }
);

// --- UI ---
const gui = new GUI({ title: 'Heart Control' });
gui.add(config, 'particleCount', 1000, 5000, 100).onChange(v => heartSystem.setParticleCount(v));
gui.addColor(config, 'baseColor').onChange(v => {
    heartSystem.params.color1.set(v);
});
const bloomFolder = gui.addFolder('Glow Effect');
bloomFolder.add(config, 'bloomStrength', 0, 3).onChange(updateBloom);
bloomFolder.add(config, 'bloomRadius', 0, 1).onChange(updateBloom);
bloomFolder.add(config, 'bloomThreshold', 0, 1).onChange(updateBloom);
gui.add(config, 'reset');

function updateBloom() {
    bloomManager.updateSettings(config);
}

function resetSystem() {
    heartSystem.initParticles();
    state.gesture = { type: 'IDLE', strength: 0 };
}

function updateStatusUI(g) {
    if (g.type === 'IDLE') {
        statusText.innerText = "Waiting for Hand...";
        statusDot.className = "dot";
    } else if (g.type === 'EXPAND') {
        statusText.innerText = "Expanding";
        statusDot.className = "dot active";
    } else if (g.type === 'CONTRACT') {
        statusText.innerText = "Contracting";
        statusDot.className = "dot warn";
    }
}

// --- STATS ---
const stats = new Stats();
document.body.appendChild(stats.dom);

// --- LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    stats.begin();

    controls.update();

    // Update Heart with gesture state
    // We pass the raw gesture state.
    // If rotation is defined in gesture, pass it.
    heartSystem.update(delta, state.gesture);

    // Render with Bloom
    bloomManager.render();

    stats.end();
}

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomManager.resize(window.innerWidth, window.innerHeight);
});

// --- INIT ---
// Hide loader after a brief moment (or wait for first frame)
setTimeout(() => {
    if (loader) loader.style.opacity = 0;
    setTimeout(() => {
        if (loader) loader.style.display = 'none';
        animate(); // Start loop
    }, 500);
}, 1000); // 1s fake load time + wait for modules

// Error Handling hook for user
window.addEventListener('error', (e) => {
    statusText.innerText = "Error: " + e.message;
    statusDot.className = "dot error";
});

console.log("App Initialized");
