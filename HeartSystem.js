import * as THREE from 'three';

export class HeartSystem {
    constructor(scene, maxCount = 5000) {
        this.scene = scene;
        this.maxCount = maxCount;
        this.currentCount = 3000;
        this.geometry = new THREE.BufferGeometry();

        // Arrays
        this.posArray = new Float32Array(this.maxCount * 3); // current positions
        this.targetArray = new Float32Array(this.maxCount * 3); // home positions
        this.velArray = new Float32Array(this.maxCount * 3); // velocities
        this.colorArray = new Float32Array(this.maxCount * 3);

        // State
        this.time = 0;
        this.pulseSpeed = 1.0; // BPM factor

        // Uniforms / Settings
        this.params = {
            color1: new THREE.Color('#ff0055'), // Deep Crimson
            color2: new THREE.Color('#ff00ff'), // Neon Pink
            springStrength: 0.05,
            damping: 0.92,
            noiseStrength: 0.2
        };

        this.initParticles();

        // Material
        const texture = this.createGlowTexture();
        this.material = new THREE.PointsMaterial({
            size: 0.4, // scalable
            map: texture,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.mesh = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.mesh);

        // Group for rotation
        this.container = new THREE.Group();
        this.container.add(this.mesh);
        this.scene.add(this.container);
    }

    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    // Parametric Heart Generator
    getHeartPoint(t, scale) {
        // x = 16sin^3(t)
        // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

        // Scale for volume
        // Z distribution: Thicker at top lobes, thinner at bottom point
        // Heuristic: Z is proportional to some function of x,y or just random.
        // Let's use simple random box scaled by the radial distance to keep it contained.
        const z = (Math.random() - 0.5) * 10 * scale;

        return new THREE.Vector3(x * scale, y * scale, z);
    }

    initParticles() {
        for (let i = 0; i < this.maxCount; i++) {
            this.resetParticle(i);
        }
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.posArray, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colorArray, 3));
    }

    resetParticle(i) {
        // Distribute points inside the heart volume
        // We can sample t [0, 2PI] and r [0, 1] (sqrt distribution for area)
        const t = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()); // Uniform area distribution

        const p = this.getHeartPoint(t, r);

        // Center the heart roughly (it's already centered at 0,0 mostly but y is shifted up)
        // The formula outputs Y roughly in [-17, 13]. Center is around -2?
        p.y += 2;

        // Initial positions (random cloud or already at target)
        // Let's start at target
        this.posArray[i * 3] = p.x;
        this.posArray[i * 3 + 1] = p.y;
        this.posArray[i * 3 + 2] = p.z;

        this.targetArray[i * 3] = p.x;
        this.targetArray[i * 3 + 1] = p.y;
        this.targetArray[i * 3 + 2] = p.z;

        this.velArray[i * 3] = 0;
        this.velArray[i * 3 + 1] = 0;
        this.velArray[i * 3 + 2] = 0;
    }

    setParticleCount(count) {
        this.currentCount = Math.min(count, this.maxCount);
        this.geometry.setDrawRange(0, this.currentCount);
    }

    update(dt, gestureState) {
        this.time += dt * this.pulseSpeed;

        // Heartbeat Pulse (Sine wave scaling)
        // BPM ~ 60 => 1 beat per second. sin(time * PI).
        const beat = 1 + Math.sin(this.time * 3) * 0.05 * (1 + Math.sin(this.time * 3 + Math.PI) * 0.5); // irregular beat
        const pulseScale = beat;

        const positions = this.geometry.attributes.position.array;
        const colors = this.geometry.attributes.color.array;

        // Extract Gesture Physics
        // Expand: radial force outwards
        // Contract: suction to 0,0,0
        // Rotate: handled by container rotation in main loop or here

        const isExp = gestureState.type === 'EXPAND';
        const isCon = gestureState.type === 'CONTRACT';
        const handStrength = gestureState.strength || 0;

        for (let i = 0; i < this.currentCount; i++) {
            const idx = i * 3;
            let px = positions[idx];
            let py = positions[idx + 1];
            let pz = positions[idx + 2];

            let tx = this.targetArray[idx] * pulseScale;
            let ty = this.targetArray[idx + 1] * pulseScale;
            let tz = this.targetArray[idx + 2] * pulseScale;

            // --- Physics Forces ---
            let fx = 0, fy = 0, fz = 0;

            // 1. Spring Force to Home
            fx += (tx - px) * this.params.springStrength;
            fy += (ty - py) * this.params.springStrength;
            fz += (tz - pz) * this.params.springStrength;

            // 2. Gesture Forces
            if (isExp) {
                // Explosion: push away from center
                // Normalized vector from center
                const len = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
                const push = 50 * handStrength; // Strong push
                fx += (px / len) * push * dt;
                fy += (py / len) * push * dt;
                fz += (pz / len) * push * dt;
            } else if (isCon) {
                // Implosion: pull to center
                // Override target to be 0,0,0 effectively
                fx -= px * 5 * handStrength * dt;
                fy -= py * 5 * handStrength * dt;
                fz -= pz * 5 * handStrength * dt;
            }

            // 3. Noise / Brownian
            fx += (Math.random() - 0.5) * this.params.noiseStrength;
            fy += (Math.random() - 0.5) * this.params.noiseStrength;
            fz += (Math.random() - 0.5) * this.params.noiseStrength;


            // Integration (Euler)
            this.velArray[idx] += fx;
            this.velArray[idx + 1] += fy;
            this.velArray[idx + 2] += fz;

            // Damping
            this.velArray[idx] *= this.params.damping;
            this.velArray[idx + 1] *= this.params.damping;
            this.velArray[idx + 2] *= this.params.damping;

            // Update Position
            positions[idx] += this.velArray[idx];
            positions[idx + 1] += this.velArray[idx + 1];
            positions[idx + 2] += this.velArray[idx + 2];

            // Color Dynamics based on Velocity Magnitude
            const vSq = this.velArray[idx] ** 2 + this.velArray[idx + 1] ** 2 + this.velArray[idx + 2] ** 2;
            const speed = Math.sqrt(vSq);

            // Lerp color
            // Low speed = Deep Crimson (color1)
            // High speed = Neon Pink (color2)
            const tColor = Math.min(speed * 0.5, 1.0);

            colors[idx] = THREE.MathUtils.lerp(this.params.color1.r, this.params.color2.r, tColor);
            colors[idx + 1] = THREE.MathUtils.lerp(this.params.color1.g, this.params.color2.g, tColor);
            colors[idx + 2] = THREE.MathUtils.lerp(this.params.color1.b, this.params.color2.b, tColor);
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;

        if (gestureState.rotationY !== undefined) {
            // Smooth rotation
            // this.container.rotation.y = gestureState.rotationY; 
            // Lerp rotation for smoothness
            this.container.rotation.y += (gestureState.rotationY - this.container.rotation.y) * 0.1;
        } else {
            this.container.rotation.y += dt * 0.1; // Idle spin
        }
    }
}
