import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class BloomManager {
    constructor(scene, camera, renderer, width, height) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Configure tone mapping for HDR glow
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Optional if using OutputPass, but good for base renderer

        // Render Target (High Precision for HDR Bloom)
        const renderTarget = new THREE.WebGLRenderTarget(
            width, height,
            {
                type: THREE.HalfFloatType,
                format: THREE.RGBAFormat,
                colorSpace: THREE.LinearSRGBColorSpace // Linear for processing
            }
        );

        // Composer
        this.composer = new EffectComposer(this.renderer, renderTarget);
        this.composer.setSize(width, height);

        // 1. Render Pass
        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);

        // 2. Bloom Pass
        // resolution, strength, radius, threshold
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            1.5, // strength
            0.4, // radius
            0.85 // threshold
        );
        this.composer.addPass(this.bloomPass);

        // 3. Output Pass (Tone Mapping + sRGB conversion)
        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
    }

    resize(width, height) {
        this.composer.setSize(width, height);
        this.bloomPass.strength = this.bloomPass.strength; // trigger update? no need usually.
    }

    render() {
        this.composer.render();
    }

    updateSettings(params) {
        if (params.bloomStrength !== undefined) this.bloomPass.strength = params.bloomStrength;
        if (params.bloomRadius !== undefined) this.bloomPass.radius = params.bloomRadius;
        if (params.bloomThreshold !== undefined) this.bloomPass.threshold = params.bloomThreshold;
    }
}
