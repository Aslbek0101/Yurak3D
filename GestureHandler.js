import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class GestureHandler {
    constructor(videoElement, onGestureUpdate) {
        this.video = videoElement;
        this.onGestureUpdate = onGestureUpdate;
        this.landmarker = null;
        this.lastVideoTime = -1;
        this.isReady = false;

        this.init();
    }

    async init() {
        try {
            console.log("Initializing Vision...");
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
            );

            this.landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });

            console.log("Vision Initialized. Starting Camera...");

            // Start Camera
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
            this.video.addEventListener("loadeddata", () => {
                this.isReady = true;
                console.log("Camera Ready. Starting Predictions.");
                this.predict();
            });
        } catch (error) {
            console.error("GestureHandler Init Error:", error);
            // Report to global error handler if available
            if (window.showError) {
                window.showError(`Vision Init Failed: ${error.message}\n(App will continue in Demo Mode)`);
            }
        }
    }

    predict() {
        if (!this.landmarker) return;

        // Loop
        requestAnimationFrame(() => this.predict());

        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            const result = this.landmarker.detectForVideo(this.video, performance.now());
            this.processResult(result);
        }
    }

    processResult(result) {
        // Output State:
        // type: 'IDLE' | 'EXPAND' | 'CONTRACT'
        // strength: 0.0 - 1.0
        // rotationY: float (radians) relative to center of screen

        let state = {
            type: 'IDLE',
            strength: 0,
            rotationY: undefined
        };

        if (result.landmarks.length > 0) {
            // 1. Rotation from Palm Center X
            // Use the first hand found for rotation
            const hand1 = result.landmarks[0];
            const wrist = hand1[0];
            // Map x [0, 1] to [-PI, PI]
            // MediaPipe x is normalized 0-1. 0 is left, 1 is right.
            // Mirroring might be an issue, assume video is mirrored in CSS (transform: scaleX(-1))
            // but coordinates are raw.
            // If user moves hand right (screen right), x increases.
            state.rotationY = (wrist.x - 0.5) * Math.PI * 2;

            // 2. Gestures
            // Check for Fist (Contract)
            let isFist = this.isFist(hand1);
            if (result.landmarks.length > 1 && this.isFist(result.landmarks[1])) {
                isFist = true; // Two fists = SUPER CONTRACT? just contract.
            }

            if (isFist) {
                state.type = 'CONTRACT';
                state.strength = 1.0;
            } else {
                // Check for Expand (Pinch Open vs Closed or Two Hands moving apart)
                // User said: "Distance between Thumb and Index finger tips increases"
                // OR "hands move apart".

                if (result.landmarks.length === 2) {
                    // Two hands apart?
                    const h1 = result.landmarks[0][0];
                    const h2 = result.landmarks[1][0];
                    const dist = Math.hypot(h1.x - h2.x, h1.y - h2.y);
                    if (dist > 0.5) {
                        state.type = 'EXPAND';
                        state.strength = (dist - 0.5) * 2; // scale up
                    }
                } else {
                    // One hand pinch open?
                    // distance between tip 4 and tip 8
                    const thumbTip = hand1[4];
                    const indexTip = hand1[8];
                    const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

                    // Normal rest pinch dist is ~0.05-0.1
                    // Wide open "L" shape is > 0.2
                    if (dist > 0.25) {
                        state.type = 'EXPAND';
                        state.strength = (dist - 0.25) * 3;
                    }
                }
            }
        }

        this.onGestureUpdate(state);
    }

    isFist(landmarks) {
        // Simple algorithm: Fingertips closer to wrist than PIP joints?
        // Or simplified: tips are "down" relative to palm?
        // Let's use the standard "tip is lower than pip" check relative to local hand frame, 
        // but easier: check distance of tips to wrist vs mcp to wrist.

        const wrist = landmarks[0];
        let foldedFingers = 0;

        // Indices for tips and PIPs (Index, Middle, Ring, Pinky)
        const tips = [8, 12, 16, 20];
        const pips = [6, 10, 14, 18]; // PIP is the joint in middle of finger

        for (let i = 0; i < 4; i++) {
            const dTip = Math.hypot(landmarks[tips[i]].x - wrist.x, landmarks[tips[i]].y - wrist.y);
            const dPip = Math.hypot(landmarks[pips[i]].x - wrist.x, landmarks[pips[i]].y - wrist.y);
            if (dTip < dPip) foldedFingers++;
        }

        return foldedFingers >= 3; // 3 or more fingers folded = Fist
    }
}
