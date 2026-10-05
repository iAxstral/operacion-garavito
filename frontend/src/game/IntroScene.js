import Phaser from 'phaser';
import logoUrl from '../assets/intro/eci-logo.png';
import titleFontUrl from '../assets/fonts/blockstepped/Blockstepped 3D.ttf';

// Paleta institucional: rojo de la ECI + acento morado del juego (ver favicon.svg)
const COLORS = {
    dustRed: 0xb23a3a,
    dustAccent: 0x9a5cff,
    accent: 0x7e14ff,
};

const LOGO_SCALE = 0.5;
const FALL_DURATION = 950; // ms, caída inicial del logo
const HOLD_DURATION = 1100; // ms, cuánto se queda el logo quieto antes de dar paso al título
const EXIT_DURATION = 480; // ms, caída/salida final del logo
const LETTERBOX_HEIGHT = 54;
const HITSTOP_MS = 70;

// Fuente de juego: propia, pixel/8-bit con relieve integrado (Blockstepped 3D)
const TITLE_FONT_FAMILY = 'BlockstepperTitulo';
const LETTER_STAGGER_MS = 55; // separación entre la aparición de cada letra

export default class IntroScene extends Phaser.Scene {
    constructor() {
        super('IntroScene');
    }

    preload() {
        this.load.image('eci-logo', logoUrl);
    }

    create() {
        const { width, height } = this.scale;
        this.width = width;
        this.height = height;
        this.centerY = height / 2 - 40;

        // Fix de nitidez: solo esta escena renderiza sin "snap" a píxel entero.
        // MainScene no se toca, sigue con su look pixel-art intacto.
        this.cameras.main.roundPixels = false;
        this.cameras.main.setBackgroundColor('#000000'); // negro puro, estilo Ubisoft

        this.createDustTexture();
        this.createAmbientParticles(width, height);
        this.createGlow(width / 2, this.centerY);
        this.createLetterbox(width, height);
        this.startKenBurns();

        // Empieza a cargar la fuente del título ya mismo; para cuando la necesitemos
        // (~2s después) casi siempre ya estará lista.
        this.fontReady = this.loadLocalFont(TITLE_FONT_FAMILY, titleFontUrl);

        this.logo = this.add.image(width / 2, -200, 'eci-logo').setScale(LOGO_SCALE).setDepth(10);
        // Filtrado suave solo para el logo: evita el efecto "bloques" al escalar/rotar.
        this.logo.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

        this.dropWithBounce(this.logo, this.centerY, FALL_DURATION, {
            onLand: () => this.onLogoImpact(),
        });
    }

    /**
     * Deja caer cualquier GameObject desde arriba de la pantalla hasta targetY,
     * con rebote real (easing) + rotación leve + callback al aterrizar.
     * Reutilizada por el logo y por el título para no duplicar la coreografía.
     */
    dropWithBounce(target, targetY, duration, { onLand } = {}) {
        this.tweens.add({
            targets: target,
            y: targetY,
            duration,
            ease: 'Bounce.easeOut',
            onComplete: () => onLand && onLand(),
        });

        this.tweens.add({
            targets: target,
            angle: Phaser.Math.Between(-10, 10),
            duration,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.tweens.add({ targets: target, angle: 0, duration: 180, ease: 'Sine.easeOut' });
            },
        });
    }

    startKenBurns() {
        this.cameras.main.setZoom(1.06);
        this.tweens.add({ targets: this.cameras.main, zoom: 1.0, duration: 6000, ease: 'Sine.easeOut' });
    }

    createAmbientParticles(width, height) {
        this.add.particles(0, 0, 'dust-particle-accent', {
            x: { min: 0, max: width },
            y: { min: 0, max: height },
            lifespan: 6000,
            speedY: { min: -12, max: -4 },
            speedX: { min: -4, max: 4 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.35, end: 0 },
            frequency: 220,
            quantity: 1,
        }).setDepth(1);
    }

    createLetterbox(width, height) {
        this.barTop = this.add.rectangle(width / 2, -LETTERBOX_HEIGHT / 2, width, LETTERBOX_HEIGHT, 0x000000).setDepth(20);
        this.barBottom = this.add.rectangle(width / 2, height + LETTERBOX_HEIGHT / 2, width, LETTERBOX_HEIGHT, 0x000000).setDepth(20);
        this.tweens.add({ targets: this.barTop, y: LETTERBOX_HEIGHT / 2, duration: 500, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: this.barBottom, y: height - LETTERBOX_HEIGHT / 2, duration: 500, ease: 'Cubic.easeOut' });
    }

    createGlow(x, y) {
        const size = 340;
        if (!this.textures.exists('intro-glow')) {
            const canvasTexture = this.textures.createCanvas('intro-glow', size, size);
            const ctx = canvasTexture.getContext();
            const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
            gradient.addColorStop(0.35, 'rgba(154,92,255,0.45)'); // acento morado del juego
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            canvasTexture.refresh();
        }

        // Se crea invisible; solo aparece cuando llamemos a revealGlow(), una vez el logo ya esté quieto.
        this.glow = this.add.image(x, y, 'intro-glow').setAlpha(0).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    }

    /** Enciende la luz "un poquito" detrás del logo, ya asentado (no mientras cae). */
    revealGlow() {
        this.tweens.add({ targets: this.glow, alpha: 0.55, duration: 500, ease: 'Sine.easeOut' });
    }

    onLogoImpact() {
        // Hit-stop: el tiempo casi se congela una fracción de segundo antes del golpe real.
        this.tweens.timeScale = 0.06;
        this.time.timeScale = 0.06;

        this.time.addEvent({
            delay: HITSTOP_MS,
            callback: () => {
                this.tweens.timeScale = 1;
                this.time.timeScale = 1;
                this.resolveLogoImpact();
            },
        });
    }

    resolveLogoImpact() {
        this.cameras.main.shake(140, 0.005);

        this.tweens.add({
            targets: this.logo,
            scaleX: LOGO_SCALE * 1.12,
            scaleY: LOGO_SCALE * 0.88,
            duration: 90,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.startIdleBreathing();
                this.playShineSweep();
                this.revealGlow();
                // El logo se queda un momento en pantalla, luego cede el paso al título.
                this.time.delayedCall(HOLD_DURATION, () => this.exitLogoAndShowTitle());
            },
        });

        this.emitImpactRing(this.logo.x, this.logo.y);
        this.emitDust();
    }

    emitImpactRing(x, y) {
        const ring = this.add.circle(x, y, 10, COLORS.accent, 0).setStrokeStyle(3, COLORS.accent, 0.8).setDepth(4);
        this.tweens.add({
            targets: ring,
            radius: 90,
            alpha: 0,
            duration: 450,
            ease: 'Cubic.easeOut',
            onUpdate: () => ring.setStrokeStyle(3, COLORS.accent, ring.alpha),
            onComplete: () => ring.destroy(),
        });
    }

    startIdleBreathing() {
        this.breathTween = this.tweens.add({
            targets: this.logo,
            scaleX: LOGO_SCALE * 1.03,
            scaleY: LOGO_SCALE * 1.03,
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    playShineSweep() {
        const w = this.logo.displayWidth;
        const h = this.logo.displayHeight;

        if (!this.textures.exists('shine-strip')) {
            const shineGfx = this.make.graphics({ x: 0, y: 0, add: false });
            shineGfx.fillStyle(0xffffff, 1);
            shineGfx.fillRect(0, 0, w * 0.18, h * 1.6);
            shineGfx.generateTexture('shine-strip', w * 0.18, h * 1.6);
            shineGfx.destroy();
        }

        const shine = this.add.image(this.logo.x - w * 0.7, this.logo.y, 'shine-strip')
            .setAngle(24).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(11);

        this.tweens.add({
            targets: shine,
            x: this.logo.x + w * 0.7,
            duration: 650,
            ease: 'Cubic.easeInOut',
            onComplete: () => shine.destroy(),
        });
    }

    /** El logo cae/desaparece de nuevo y, justo después, entra el título con la misma coreografía. */
    exitLogoAndShowTitle() {
        if (this.breathTween) this.breathTween.stop();

        this.tweens.add({
            targets: [this.logo, this.glow],
            y: '+=260',
            alpha: 0,
            duration: EXIT_DURATION,
            ease: 'Cubic.easeIn', // acelera como si cayera por su propio peso
            onComplete: () => {
                this.logo.destroy();
                this.glow.destroy();
                this.showTitle();
            },
        });
    }

    async showTitle() {
        await this.fontReady;
        this.revealTitleLetterByLetter(['OPERACION', 'GARAVITO']);
    }

    titleStyle() {
        return { fontFamily: `"${TITLE_FONT_FAMILY}"`, fontSize: '58px', color: '#ffffff' };
    }

    /** Muestra cada línea centrada, apareciendo letra por letra en cascada (look Ubisoft/AAA). */
    revealTitleLetterByLetter(lines) {
        const LINE_HEIGHT = 58;
        const startY = this.centerY - ((lines.length - 1) * LINE_HEIGHT) / 2;
        const letters = [];
        let globalIndex = 0;

        lines.forEach((line, lineIdx) => {
            // Texto invisible solo para medir el ancho real de la línea con esta fuente/tamaño.
            const measurer = this.add.text(0, 0, line, this.titleStyle()).setVisible(false);
            const lineWidth = measurer.width;
            measurer.destroy();

            let cursorX = this.width / 2 - lineWidth / 2;
            const y = startY + lineIdx * LINE_HEIGHT;

            [...line].forEach((char) => {
                const letter = this.add.text(cursorX, y, char, this.titleStyle())
                    .setOrigin(0, 0.5)
                    .setAlpha(0)
                    .setDepth(10);
                cursorX += letter.width;

                if (char !== ' ') {
                    const delay = globalIndex * LETTER_STAGGER_MS;
                    letter.setScale(1.6);
                    this.tweens.add({
                        targets: letter,
                        alpha: 1,
                        scale: 1,
                        duration: 260,
                        delay,
                        ease: 'Back.easeOut',
                    });
                    globalIndex += 1;
                }
                letters.push(letter);
            });
        });

        const totalDelay = globalIndex * LETTER_STAGGER_MS + 260;
        this.time.delayedCall(totalDelay, () => this.onTitleImpact(letters));
    }

    onTitleImpact(letters) {
        this.cameras.main.shake(120, 0.004);
        const centerX = this.width / 2;
        this.emitImpactRing(centerX, this.centerY);
    }

    createDustTexture() {
        const gfx = this.make.graphics({ x: 0, y: 0, add: false });
        gfx.fillStyle(COLORS.dustRed, 1);
        gfx.fillCircle(4, 4, 4);
        gfx.generateTexture('dust-particle-red', 8, 8);
        gfx.fillStyle(COLORS.dustAccent, 1);
        gfx.fillCircle(4, 4, 4);
        gfx.generateTexture('dust-particle-accent', 8, 8);
        gfx.destroy();
    }

    emitDust() {
        const originY = this.logo.y + this.logo.displayHeight / 2 - 10;
        ['dust-particle-red', 'dust-particle-accent'].forEach((texture) => {
            const emitter = this.add.particles(this.logo.x, originY, texture, {
                speed: { min: 40, max: 120 },
                angle: { min: 200, max: 340 },
                scale: { start: 0.9, end: 0 },
                alpha: { start: 0.8, end: 0 },
                lifespan: 500,
                quantity: 8,
                emitting: false,
            });
            emitter.explode(8);
        });
    }

    /** Carga un archivo de fuente local (.ttf/.otf/.woff2) y lo registra con el nombre dado. */
    loadLocalFont(family, url) {
        const face = new FontFace(family, `url(${url})`);
        return face.load().then((loadedFace) => {
            document.fonts.add(loadedFace);
        });
    }
}