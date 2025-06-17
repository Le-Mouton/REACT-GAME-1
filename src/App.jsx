import { useEffect, useRef, useState } from "react";

export default function App() {

    const canvasRef = useRef(null);
    const [clicks, setClicks] = useState(0);
    const [clickCount, setClickCount] = useState(0);
    const clickCountRef = useRef(0);
    const [lastClickTime, setLastClickTime] = useState(() => performance.now());
    const lastClickRef = useRef(lastClickTime);

    const square = useRef({
        x: window.innerWidth / 2,
        y: window.innerHeight / 10,
        size:  window.innerHeight/35,
        vy: 0,
        rotation: 0,
        rotationSpeed: 0,
        rotationBoosted: false,
        isFalling: false,
        fallStartTime: null,
        wallHitTime: null,
        vertHitTime: null,
        isDisintegrated: false,
        rotationBoostStart: null,
        directionX: 0,
    });

    const cameraOffsetY = useRef(0);

    useEffect(() => {

        let invincibleStart = performance.now();
        const invincibleDuration = 2000; // en ms (2 secondes d'invincibilité)
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        resizeCanvas();

        window.addEventListener("resize", resizeCanvas);

        const gravity = window.innerHeight / 2500;
        let lastFrame = performance.now();

        let score = 0;
        let lapCount = 0;
        let difficulty = 1;
        let platforms = [];
        let bombs = [];
        let gates = [];
        function generateGate() {
            const sides = ["left", "right", "top", "bottom"];
            const side = sides[Math.floor(Math.random() * sides.length)];

            const thickness = 20;
            const gateLength = 100;
            let gate;

            if (side === "left" || side === "right") {
                const y = 100 + Math.random() * (canvas.height - 200);
                gate = {
                    side,
                    x: side === "left" ? 0 : canvas.width - thickness,
                    y,
                    width: thickness,
                    height: gateLength,
                    isActive: true
                };
            } else {
                const x = 100 + Math.random() * (canvas.width - 200);
                gate = {
                    side,
                    x,
                    y: side === "top" ? 0 : canvas.height - thickness,
                    width: gateLength,
                    height: thickness,
                    isActive: true
                };
            }

            gates.push(gate);
        }

        function generateFloatingBombs(count = 3 + Math.floor(difficulty / 2)) {
            bombs = [];
            for (let i = 0; i < count; i++) {
                const size = window.innerHeight/50;
                const x = Math.random() * (canvas.width - size);
                const y = 100 + Math.random() * (canvas.height - 200);
                bombs.push({ x, y, size, timer: 0, exploded: false });
            }
        }
        function generatePlatforms({
             count = 3 + difficulty,
             minWidth = Math.max(80, 120 - difficulty * 5),
             maxWidth = Math.max(100, 200 - difficulty * 10)
         } = {}) {
            const verticalSpacing = canvas.height / count;
            platforms = [];
            for (let i = 0; i < count; i++) {
                const width = minWidth + Math.random() * (maxWidth - minWidth);
                const height = window.innerHeight/100;
                const x = Math.random() * (canvas.width - width);
                const y = i * verticalSpacing + 50;
                platforms.push({
                    x,
                    y,
                    width,
                    height,
                    isTouched: false,
                    fadeProgress: 0,
                });
            }
        }

        generatePlatforms();
        generateFloatingBombs();
        generateGate();

        function drawFrame(timestamp) {
            const invincible = performance.now() - invincibleStart < invincibleDuration;
            const delta = timestamp - lastFrame;
            lastFrame = timestamp;
            const now = timestamp;


            const s = square.current;
            s.vy += gravity;
            s.y += s.vy;

            s.x += s.directionX;
            s.rotation += s.rotationSpeed;
            s.rotationSpeed *= 0.98; // inertie, ralentissement progressif
            // Atténuation vers l'angle neutre (0)
            if (Math.abs(s.rotationSpeed) < 0.01) {
                if (Math.abs(s.rotation) > 0.01) {
                    s.rotation *= 0.9; // amortissement vers 0
                } else {
                    s.rotation = 0;
                }
            }
            s.directionX *= 1;


            if (timestamp - lastClickRef.current > 5000 && !invincible) {
                s.isDisintegrated = true;
            }


            // Rebond sur les murs
            if (s.x < 0 && !s.isDisintegrated) {
                s.x = 0;
                s.directionX = Math.abs(s.directionX);
                s.wallHitTime = now;
            } else if (s.x + s.size > canvas.width && !s.isDisintegrated) {
                s.x = canvas.width - s.size;
                s.directionX = -Math.abs(s.directionX);
                s.wallHitTime = now;
            }

            // Rebond sur le sol
            if (s.y + s.size > canvas.height && !s.isDisintegrated) {
                s.y = canvas.height - s.size;
                s.vy = -Math.abs(s.vy);
                s.vertHitTime = now;
            } else if (s.y < 0 && !s.isDisintegrated) {
                s.y = 0;
                s.vy = Math.abs(s.vy);
                s.vertHitTime = now;
            }

            // ⚠️ Boost si double rebond proche
            if (
                s.wallHitTime && s.vertHitTime &&
                Math.abs(s.wallHitTime - s.vertHitTime) < 150 &&
                !s.rotationBoosted && !s.isDisintegrated
            ) {
                score += 5;
                s.vy *= 1.1;
                s.directionX *= 1.1;
                s.rotationSpeed = 0.3 * (Math.random() > 0.5 ? 1 : -1);
                s.rotationBoosted = true;
                s.rotationBoostStart = now;

                // Clamp après le boost
                s.vy = Math.max(-20, Math.min(s.vy, 20));
                s.directionX = Math.max(-10, Math.min(s.directionX, 10));
            }

            if (!s.isDisintegrated) {
                for (let p of platforms) {
                    // Collision avec plateforme
                    if (!p.isTouched &&
                        s.x + s.size > p.x &&
                        s.x < p.x + p.width &&
                        s.y + s.size > p.y &&
                        s.y + s.size < p.y + p.height + 10 &&
                        s.vy >= 0
                    ) {
                        s.vy = -5;
                        p.isTouched = true;
                        if(s.rotationBoosted) {
                            score += 1000;
                        } else { score += 500; }
                    }

                    if (p.isTouched) {
                        p.fadeProgress += 0.01;
                    }
                }
            } else {
                for (let p of platforms) {
                    p.fadeProgress += 0.01;
                }
                for (const bomb of bombs) {
                    bomb.exploded = true;
                }
            }

            for (const bomb of bombs) {
                if (bomb.exploded) continue;

                // Temps écoulé
                bomb.timer += delta;

                // Explosion automatique si délai dépassé
                if (bomb.timer > 45000) {
                    bomb.exploded = true;
                    const dx = s.x + s.size / 2 - (bomb.x + bomb.size / 2);
                    const dy = s.y + s.size / 2 - (bomb.y + bomb.size / 2);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100 && !s.rotationBoosted && !invincible) {
                        s.isDisintegrated = true;
                    }
                    for (let p of platforms) {
                        p.fadeProgress = Math.max(p.fadeProgress, 0.01);
                    }
                }

                // Collision directe
                const dx = s.x + s.size / 2 - (bomb.x + bomb.size / 2);
                const dy = s.y + s.size / 2 - (bomb.y + bomb.size / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < s.size / 2 + bomb.size / 2 && !bomb.exploded) {
                    if (s.rotationBoosted) {
                        bomb.exploded = true;
                    } else if (!invincible) {
                            s.isDisintegrated = true;
                    }
                }
            }
            for (const gate of gates) {
                if (!gate.isActive) continue;

                const inGateX = square.current.x + square.current.size > gate.x &&
                    square.current.x < gate.x + gate.width;
                const inGateY = square.current.y + square.current.size > gate.y &&
                    square.current.y < gate.y + gate.height;

                if (inGateX && inGateY) {
                    if (gate.side === "left") {
                        square.current.x = canvas.width - square.current.size - 1;
                    } else if (gate.side === "right") {
                        square.current.x = 1;
                    } else if (gate.side === "top") {
                        square.current.y = canvas.height - square.current.size - 1;
                    } else if (gate.side === "bottom") {
                        square.current.y = 1;
                    }

                    square.current.rotationSpeed = 0.6 * (Math.random() > 0.5 ? 1 : -1);
                }
            }
            for (let p of platforms) {
                if (p.fadeProgress > 0) {
                    p.fadeProgress += 0.01;
                }
            }
            platforms = platforms.filter(p => p.fadeProgress < 1);
            if (
                s.rotationBoosted &&
                now - (s.rotationBoostStart || 0) > 3000 &&
                !s.isDisintegrated
            ) {
                s.rotationBoosted = false;
                s.rotationBoostStart = null;
            }

            // Supprime les plateformes complètement fondues
            platforms = platforms.filter(p => p.fadeProgress < 1);

            if (platforms.length === 0 && !s.isDisintegrated) {
                invincibleStart = performance.now(); // reset invincibilité
                lapCount += 1;
                difficulty += 1;

                generatePlatforms();
                generateFloatingBombs();

                gates = [];  // supprime les anciennes portes
                generateGate();
            }

            // Dessine le fond gradient dynamique
            const scaleY = 1 + Math.min(Math.abs(s.vy) / 10, 1); // de 1 à 2
            const gradientHeight = canvas.height/2 * scaleY;
            const offsetY = -((gradientHeight - canvas.height) / 2);
            const gradient = ctx.createLinearGradient(0, offsetY, 0, offsetY + gradientHeight);
            gradient.addColorStop(0, "rgba(5,1,10,0.2)");
            gradient.addColorStop(1, "rgba(24,0,51,0.5)");

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (!s.isDisintegrated) {
                let alpha = 1;
                const elapsed = timestamp - lastClickRef.current;
                alpha = Math.max(0, 1 - elapsed / 5000); // diminue linéairement de 1 à 0

                ctx.save();
                ctx.translate(s.x + s.size / 2, s.y - cameraOffsetY.current + s.size / 2);
                ctx.rotate(s.rotation);
                if (s.rotationBoosted) {
                    ctx.fillStyle = `rgba(199, 0, 0, ${alpha.toFixed(2)})`;

                }else{
                    ctx.fillStyle = `rgba(199, 203, 255, ${alpha.toFixed(2)})`;
                }
                ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
                ctx.restore();
            } else {
                ctx.fillStyle = "white";
                ctx.font = "45px 'Lexend Zetta', sans-serif";
                ctx.fillText("Disparu ...",window.innerWidth /2 + 45 * 4, window.innerHeight/2);
            }
            for (let p of platforms) {
                ctx.fillStyle = `rgba(255,255,255,${1 - p.fadeProgress})`;
                ctx.fillRect(p.x, p.y - cameraOffsetY.current, p.width, p.height);
            }
            for (const bomb of bombs) {
                if (bomb.exploded) continue;
                ctx.fillStyle = "red";
                ctx.beginPath();
                ctx.arc(bomb.x + bomb.size / 2, bomb.y + bomb.size / 2, bomb.size / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "white";
                ctx.font = "12px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(`${Math.ceil((45000 - bomb.timer) / 1000)}`, bomb.x + bomb.size / 2, bomb.y + bomb.size + 12);
            }
            // Affichage score + clics (haut droit)
            ctx.font = "20px 'Lexend Zetta', sans-serif";
            ctx.fillStyle = "white";
            ctx.textAlign = "right";
            ctx.fillText(`Score: ${score}`, canvas.width - 20, 40);
            ctx.fillText(`Clicks: ${clickCountRef.current}`, canvas.width - 20, 70);
            ctx.fillText(`Stage: ${lapCount}`, canvas.width - 20, 100);

            for (const gate of gates) {
                if (!gate.isActive || s.isDisintegrated) continue;
                ctx.fillStyle = "#ebecef";
                ctx.fillRect(gate.x, gate.y, gate.width, gate.height);
            }

            requestAnimationFrame(drawFrame);
        }


        requestAnimationFrame(drawFrame);

        return () => window.removeEventListener("resize", resizeCanvas);
    }, []);

    const handleClick = (e) => {
        const s = square.current;
        const now = performance.now();
        const clickX = e.clientX;

        // Si le carré est désintégré → recharger la page
        if (s.isDisintegrated) {
            window.location.reload();
            return;
        }

        // Incrémente le compteur
        setClickCount(c => {
            const newVal = c + 1;
            clickCountRef.current = newVal;
            return newVal;
        });

        const isDoubleClick = now - lastClickRef.current < 300;

        if (isDoubleClick) {
            // Double clic : déplace selon la zone du clic
            if (clickX < window.innerWidth / 2) {
                s.directionX = -window.innerWidth / 250;
                s.rotationSpeed = -0.3;
            } else {
                s.directionX = window.innerWidth / 250;
                s.rotationSpeed = 0.3;
            }
        } else {
            // Simple clic : saut
            s.directionX *= 0.7
            s.vy = -10 - Math.min(clicks * 0.5, 10);
            setClicks(c => Math.min(c + 1, 10));
            setTimeout(() => setClicks(c => Math.max(c - 1, 0)), 1000);
        }

        setLastClickTime(now);
        lastClickRef.current = now;
    };

    return (
        <canvas
            ref={canvasRef}
            onClick={handleClick}
            style={{
                display: "block",
                position: "fixed",
                top: 0,
                left: 0,
                background: "#081029", // fallback
            }}
        />
    );
}