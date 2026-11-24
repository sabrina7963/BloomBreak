
// =================================
// BLOOMBREAK GARDEN
// =================================

// Growth, vitality, statistics and the pixel garden scene.
// The plant grows from every minute of focused work and slowly
// fades while the user is not working.

(function() {

    let sprites = window.BLOOM_SPRITES


    // =================================
    // GROWTH SETTINGS
    // =================================

    // Total focused work needed for a plant to fully grow
    let GROW_FULL_MS = 4 * 60 * 60 * 1000

    // Focused work needed to fill vitality from 0 to 100
    let VITALITY_FILL_MS = 2 * 60 * 60 * 1000

    // Idle time needed for vitality to drop from 100 to 0
    let WITHER_MS = 48 * 60 * 60 * 1000

    // Vitality bonus for watering the plant
    let WATER_BONUS = 5

    let STAGES = [
        { name: "Seed", at: 0 },
        { name: "Sprout", at: 0.04 },
        { name: "Sapling", at: 0.15 },
        { name: "Young plant", at: 0.35 },
        { name: "Mature", at: 0.65 },
        { name: "Flourishing", at: 1 }
    ]

    let PLANTS = {
        oak:    { name: "Oak",        young: "oak_young",    mature: "oak",    bloom: "oak",          faded: "oak_autumn", dead: "dead" },
        pine:   { name: "Pine",       young: "pine_young",   mature: "pine",   bloom: "pine",         faded: null,         dead: "dead" },
        sakura: { name: "Sakura",     young: "oak_young",    mature: "sakura", bloom: "sakura_bloom", faded: null,         dead: "dead", petals: true },
        linden: { name: "Linden",     young: "bush",         mature: "olive",  bloom: "olive",        faded: null,         dead: "dead" },
        cactus: { name: "Cactus",     young: "cactus_young", mature: "cactus", bloom: "cactus",       faded: null,         dead: null, sprout: "cactus_ball", no_leaves: true },
        palm:   { name: "Palm",       young: "bush",         mature: "palm",   bloom: "palm",         faded: null,         dead: "stump" },
        jungle: { name: "Rainforest", young: "bush",         mature: "jungle", bloom: "jungle",       faded: null,         dead: "stump" }
    }

    let DEFAULT_PLANT = "oak"


    // =================================
    // STORAGE HELPERS
    // =================================

    let STATE_KEY = "bloombreak-garden"
    let STATS_KEY = "bloombreak-stats"

    let load_json = function(key) {

        try {
            let value = JSON.parse(localStorage.getItem(key))
            return value && typeof value === "object" ? value : null
        } catch (error) {
            return null
        }

    }

    let save_json = function(key, value) {

        try {
            localStorage.setItem(key, JSON.stringify(value))
        } catch (error) {
            console.error("Could not save " + key + ":", error)
        }

    }

    let clamp = function(value, min, max) {
        return Math.min(max, Math.max(min, value))
    }

    let finite_or = function(value, fallback) {
        return Number.isFinite(value) ? value : fallback
    }


    // =================================
    // GARDEN STATE
    // =================================

    let stored = load_json(STATE_KEY) || {}

    let state = {
        plant: Object.hasOwn(PLANTS, stored.plant) ? stored.plant : DEFAULT_PLANT,
        growth_ms: clamp(finite_or(stored.growth_ms, 0), 0, GROW_FULL_MS),
        vitality: clamp(finite_or(stored.vitality, 60), 0, 100),
        last_seen: finite_or(stored.last_seen, Date.now()),
        completed: Array.isArray(stored.completed)
            ? stored.completed.filter(function(item) {
                return item && Object.hasOwn(PLANTS, item.plant)
            }).slice(-200)
            : []
    }

    let mode = "idle"
    let last_update = Date.now()
    let change_listeners = []

    // Time passed while the app was closed counts as idle time
    let offline_ms = clamp(Date.now() - state.last_seen, 0, WITHER_MS * 2)
    state.vitality = clamp(state.vitality - offline_ms / WITHER_MS * 100, 0, 100)


    let save_state = function() {

        state.last_seen = Date.now()
        save_json(STATE_KEY, state)

    }


    let notify_change = function(reason) {

        change_listeners.forEach(function(listener) {
            try {
                listener(reason)
            } catch (error) {
                console.error(error)
            }
        })

    }


    let growth_fraction = function() {
        return clamp(state.growth_ms / GROW_FULL_MS, 0, 1)
    }


    let stage_index = function(fraction = growth_fraction()) {

        let index = 0

        STAGES.forEach(function(stage, i) {
            if (fraction >= stage.at) {
                index = i
            }
        })

        return index

    }


    let stage_progress = function(fraction = growth_fraction()) {

        let index = stage_index(fraction)

        if (index >= STAGES.length - 1) {
            return 1
        }

        let start = STAGES[index].at
        let end = STAGES[index + 1].at

        return clamp((fraction - start) / (end - start), 0, 1)

    }


    // Idle decay (not working and not on a break)
    let update_state = function(now = Date.now()) {

        let dt = clamp(now - last_update, 0, WITHER_MS)
        last_update = now

        if (mode === "idle" || mode === "thirsty") {
            state.vitality = clamp(
                state.vitality - dt / WITHER_MS * 100,
                0,
                100
            )
        }

    }


    // =================================
    // STATISTICS
    // =================================

    let stats = load_json(STATS_KEY) || {}

    if (!stats.days || typeof stats.days !== "object") {
        stats.days = {}
    }


    let day_key = function(date = new Date()) {

        return (
            date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0")
        )

    }


    let get_day = function(key) {

        let day = stats.days[key]

        if (!day || typeof day !== "object") {
            day = { work_ms: 0, sessions: 0 }
            stats.days[key] = day
        }

        day.work_ms = finite_or(day.work_ms, 0)
        day.sessions = finite_or(day.sessions, 0)

        return day

    }


    let prune_stats = function() {

        let keys = Object.keys(stats.days).sort()

        while (keys.length > 400) {
            delete stats.days[keys.shift()]
        }

    }


    let save_stats = function() {
        prune_stats()
        save_json(STATS_KEY, stats)
    }


    let work_ms_on = function(date) {

        let day = stats.days[day_key(date)]

        return day ? finite_or(day.work_ms, 0) : 0

    }


    let get_summary = function() {

        let today = new Date()
        let week_ms = 0

        for (let i = 0; i < 7; i++) {
            let d = new Date(today)
            d.setDate(today.getDate() - i)
            week_ms += work_ms_on(d)
        }

        // Streak: consecutive days with at least one minute of work.
        // Today does not break the streak until it is over.
        let streak = 0
        let cursor = new Date(today)

        if (work_ms_on(cursor) < 60000) {
            cursor.setDate(cursor.getDate() - 1)
        }

        while (work_ms_on(cursor) >= 60000 && streak < 1000) {
            streak++
            cursor.setDate(cursor.getDate() - 1)
        }

        let total_ms = 0
        let total_sessions = 0

        Object.values(stats.days).forEach(function(day) {
            total_ms += finite_or(day.work_ms, 0)
            total_sessions += finite_or(day.sessions, 0)
        })

        return {
            today_ms: work_ms_on(today),
            week_ms: week_ms,
            streak: streak,
            total_ms: total_ms,
            total_sessions: total_sessions,
            completed: state.completed.length
        }

    }


    // Daily totals for the last N days (oldest first)
    let get_daily_series = function(count) {

        let series = []
        let today = new Date()

        for (let i = count - 1; i >= 0; i--) {

            let d = new Date(today)
            d.setDate(today.getDate() - i)

            series.push({
                date: d,
                ms: work_ms_on(d),
                is_current: i === 0
            })

        }

        return series

    }


    // Weekly totals (weeks start on Monday) for the last N weeks
    let get_weekly_series = function(count) {

        let series = []
        let today = new Date()

        let monday = new Date(today)
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

        for (let w = count - 1; w >= 0; w--) {

            let start = new Date(monday)
            start.setDate(monday.getDate() - w * 7)

            let ms = 0

            for (let i = 0; i < 7; i++) {
                let d = new Date(start)
                d.setDate(start.getDate() + i)
                ms += work_ms_on(d)
            }

            series.push({
                date: start,
                ms: ms,
                is_current: w === 0
            })

        }

        return series

    }


    // =================================
    // GARDEN ACTIONS
    // =================================

    let add_work = function(ms) {

        if (!Number.isFinite(ms) || ms <= 0) {
            return
        }

        let previous_stage = stage_index()
        let was_full = growth_fraction() >= 1

        state.growth_ms = clamp(state.growth_ms + ms, 0, GROW_FULL_MS)

        state.vitality = clamp(
            state.vitality + ms / VITALITY_FILL_MS * 100,
            0,
            100
        )

        get_day(day_key()).work_ms += ms

        let new_stage = stage_index()

        if (new_stage !== previous_stage) {
            save_state()
            save_stats()
            notify_change(
                growth_fraction() >= 1 && !was_full ? "grown" : "stage"
            )
        }

    }


    let record_session = function() {

        get_day(day_key()).sessions += 1

        save_stats()
        save_state()

    }


    let water = function() {

        state.vitality = clamp(state.vitality + WATER_BONUS, 0, 100)
        rain_burst_until = performance.now() + 2500

        save_state()
        notify_change("water")

    }


    let set_plant = function(type) {

        if (!Object.hasOwn(PLANTS, type) || type === state.plant) {
            return
        }

        state.plant = type
        save_state()
        notify_change("plant")

    }


    let plant_new_seed = function() {

        if (growth_fraction() < 1) {
            return false
        }

        state.completed.push({
            plant: state.plant,
            completed_at: Date.now()
        })

        state.growth_ms = 0

        save_state()
        notify_change("seed")

        return true

    }


    let set_mode = function(new_mode) {

        if (!["idle", "work", "break", "thirsty"].includes(new_mode)) {
            return
        }

        update_state()
        mode = new_mode

    }


    // =================================
    // SCENE SETUP
    // =================================

    let W = 344
    let H = 180
    let GROUND_Y = 140
    let PLANT_X = W / 2
    let PLANT_BASE = 166

    let tree_image = new Image()
    tree_image.src = "images/pixel/trees.png"

    let flower_image = new Image()
    flower_image.src = "images/pixel/flowers.png"

    let garden_element = null
    let canvas = null
    let ctx = null
    let title_element = null
    let growth_bar = null
    let vitality_bar = null
    let growth_label = null
    let vitality_label = null

    let rain_burst_until = 0

    // Test panel override for the time of day (null = real clock)
    let hour_override = null


    // Small deterministic random generator
    let seeded_random = function(seed) {

        let t = seed >>> 0

        return function() {
            t += 0x6D2B79F5
            let r = Math.imul(t ^ (t >>> 15), 1 | t)
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296
        }

    }


    let hash_string = function(text) {

        let h = 2166136261

        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i)
            h = Math.imul(h, 16777619)
        }

        return h >>> 0

    }


    // =================================
    // COLOR HELPERS
    // =================================

    let hex_to_rgb = function(hex) {

        let n = parseInt(hex.slice(1), 16)

        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]

    }

    let mix = function(a, b, t) {

        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ]

    }

    // Desaturate and dim a color as the garden loses vitality
    let fade = function(color, gloom) {

        let lum = color[0] * 0.3 + color[1] * 0.59 + color[2] * 0.11
        let gray = [lum, lum, lum * 1.03]

        return mix(color, gray, gloom * 0.75).map(function(c) {
            return c * (1 - gloom * 0.12)
        })

    }

    let css = function(color, alpha = 1) {

        return (
            "rgba(" +
            Math.round(color[0]) + "," +
            Math.round(color[1]) + "," +
            Math.round(color[2]) + "," +
            alpha + ")"
        )

    }


    // =================================
    // SKY BY TIME OF DAY
    // =================================

    let SKY = {
        night: { top: hex_to_rgb("#141a33"), bottom: hex_to_rgb("#2b3560"), dark: 1 },
        dawn:  { top: hex_to_rgb("#5d6aa8"), bottom: hex_to_rgb("#f4b38a"), dark: 0.35 },
        day:   { top: hex_to_rgb("#6fb8ec"), bottom: hex_to_rgb("#cdeeff"), dark: 0 },
        dusk:  { top: hex_to_rgb("#4a4a8c"), bottom: hex_to_rgb("#f2925e"), dark: 0.35 }
    }

    let SKY_KEYS = [
        [0, "night"],
        [5, "night"],
        [6.5, "dawn"],
        [8.5, "day"],
        [17, "day"],
        [19, "dusk"],
        [20.5, "night"],
        [24, "night"]
    ]


    let sky_at = function(hour) {

        for (let i = 0; i < SKY_KEYS.length - 1; i++) {

            let [h0, k0] = SKY_KEYS[i]
            let [h1, k1] = SKY_KEYS[i + 1]

            if (hour >= h0 && hour <= h1) {

                let t = h1 === h0 ? 0 : (hour - h0) / (h1 - h0)

                return {
                    top: mix(SKY[k0].top, SKY[k1].top, t),
                    bottom: mix(SKY[k0].bottom, SKY[k1].bottom, t),
                    dark: SKY[k0].dark + (SKY[k1].dark - SKY[k0].dark) * t
                }

            }

        }

        return SKY.night

    }


    // =================================
    // SCENE OBJECTS
    // =================================

    let make_stars = function() {

        let random = seeded_random(7)
        let list = []

        for (let i = 0; i < 34; i++) {
            list.push({
                x: Math.floor(random() * W),
                y: Math.floor(random() * 95),
                phase: random() * Math.PI * 2,
                size: random() > 0.85 ? 2 : 1
            })
        }

        return list

    }

    let make_clouds = function() {

        let random = seeded_random(21)
        let list = []

        for (let i = 0; i < 7; i++) {
            list.push({
                offset: random() * (W + 120),
                y: 14 + random() * 55,
                size: 0.7 + random() * 0.7,
                speed: 2 + random() * 4
            })
        }

        return list

    }

    let make_grass = function() {

        let random = seeded_random(99)
        let list = []

        for (let i = 0; i < 26; i++) {

            let x

            do {
                x = 6 + random() * (W - 12)
            } while (Math.abs(x - PLANT_X) < 26)

            list.push({
                index: sprites.groups.grass[Math.floor(random() * sprites.groups.grass.length)],
                x: x,
                y: GROUND_Y + 4 + random() * (H - GROUND_Y - 6)
            })
        }

        return list.sort(function(a, b) { return a.y - b.y })

    }

    let stars = make_stars()
    let clouds = make_clouds()
    let grass = make_grass()

    let decor_cache = { key: "", list: [] }


    // Flowers grow around the plant as today's work adds up.
    // Mushrooms appear when the plant is neglected.
    let get_decorations = function(today_ms, vitality) {

        let flower_count = Math.min(22, Math.floor(today_ms / (10 * 60 * 1000)))
        let bush_count = today_ms >= 3 * 60 * 60 * 1000 ? 2 : (today_ms >= 2 * 60 * 60 * 1000 ? 1 : 0)
        let mushroom_count = vitality < 30 ? Math.ceil((30 - vitality) / 7) : 0

        let key = day_key() + ":" + flower_count + ":" + bush_count + ":" + mushroom_count

        if (decor_cache.key === key) {
            return decor_cache.list
        }

        let random = seeded_random(hash_string(day_key()))
        let list = []

        let place = function(group, count, scale) {

            for (let i = 0; i < count; i++) {

                let x

                do {
                    x = 8 + random() * (W - 16)
                } while (Math.abs(x - PLANT_X) < 30)

                list.push({
                    index: group[Math.floor(random() * group.length)],
                    x: x,
                    y: GROUND_Y + 8 + random() * (H - GROUND_Y - 10),
                    scale: scale
                })

            }

        }

        place(sprites.groups.flowers, flower_count, 2)
        place(sprites.groups.bushes, bush_count, 2)
        place(sprites.groups.mushrooms, mushroom_count, 2)

        list.sort(function(a, b) { return a.y - b.y })

        decor_cache = { key: key, list: list }

        return list

    }


    // =================================
    // PARTICLES
    // =================================

    let rain = []
    let particles = []
    let fireflies = []

    for (let i = 0; i < 6; i++) {
        fireflies.push({
            x: Math.random() * W,
            y: GROUND_Y - 20 + Math.random() * 40,
            phase: Math.random() * Math.PI * 2,
            speed: 0.4 + Math.random() * 0.6
        })
    }


    let update_rain = function(active, dt) {

        if (active) {
            while (rain.length < 70) {
                rain.push({
                    x: Math.random() * (W + 40) - 20,
                    y: Math.random() * -H,
                    speed: 160 + Math.random() * 80
                })
            }
        }

        rain.forEach(function(drop) {
            drop.y += drop.speed * dt
            drop.x -= 25 * dt
        })

        rain = rain.filter(function(drop) {

            if (drop.y > H) {
                if (active) {
                    drop.y = Math.random() * -40
                    drop.x = Math.random() * (W + 40) - 20
                    return true
                }
                return false
            }

            return true

        })

    }


    let spawn_particle = function(kind, crown) {

        particles.push({
            kind: kind,
            x: PLANT_X + (Math.random() - 0.5) * crown.width,
            y: crown.top + Math.random() * crown.height * 0.6,
            vx: (Math.random() - 0.5) * 12,
            vy: kind === "sparkle" ? -4 : 10 + Math.random() * 8,
            life: kind === "sparkle" ? 1.2 : 4,
            age: 0,
            phase: Math.random() * Math.PI * 2
        })

    }


    let update_particles = function(dt, t) {

        particles.forEach(function(p) {
            p.age += dt
            p.x += (p.vx + Math.sin(t * 2 + p.phase) * 8) * dt
            p.y += p.vy * dt
        })

        particles = particles.filter(function(p) {
            return p.age < p.life && p.y < H
        })

    }


    // =================================
    // PLANT APPEARANCE
    // =================================

    let tree_rect = function(name) {
        return sprites.trees[name]
    }


    let plant_spec = function() {

        let def = PLANTS[state.plant]
        let fraction = growth_fraction()
        let stage = stage_index(fraction)
        let progress = stage_progress(fraction)
        let vitality = state.vitality

        let spec

        if (stage === 0) {
            return { key: "seed", seed: true, scale: 1, stage: stage }
        }

        if (stage === 1) {
            spec = def.sprout
                ? { key: def.sprout, image: tree_image, rect: tree_rect(def.sprout), scale: 0.55 }
                : { key: "sprout", image: flower_image, rect: sprites.flowers[sprites.groups.sprouts[0]], scale: 4, mound: true }
        }

        else if (stage === 2) {
            spec = { key: def.young + ":small", image: tree_image, rect: tree_rect(def.young), scale: 0.5 }
        }

        else if (stage === 3) {
            spec = { key: def.young, image: tree_image, rect: tree_rect(def.young), scale: 0.85 }
        }

        else if (stage === 4) {
            spec = { key: def.mature, image: tree_image, rect: tree_rect(def.mature), scale: 0.8 }
        }

        else {
            spec = { key: def.bloom + ":bloom", image: tree_image, rect: tree_rect(def.bloom), scale: 1 }
        }

        // Grow slowly within each stage
        spec.scale *= 0.88 + 0.12 * progress
        spec.stage = stage

        // Neglected plants change their look
        if (vitality < 12 && def.dead && stage >= 3) {
            spec.key = def.dead
            spec.rect = tree_rect(def.dead)
            spec.image = tree_image
        }

        else if (vitality < 35 && def.faded && stage >= 4) {
            spec.key = def.faded
            spec.rect = tree_rect(def.faded)
            spec.image = tree_image
        }

        return spec

    }


    let plant_filter = function(health) {

        let saturation = 0.3 + 0.7 * health
        let sepia = (1 - health) * 0.5
        let brightness = 0.82 + 0.18 * health

        return (
            "saturate(" + saturation.toFixed(2) + ") " +
            "sepia(" + sepia.toFixed(2) + ") " +
            "brightness(" + brightness.toFixed(2) + ")"
        )

    }


    let shown = null
    let previous_shown = null
    let transition_start = 0
    let TRANSITION_MS = 1100


    // =================================
    // DRAWING
    // =================================

    let draw_sprite = function(image, rect, center_x, base_y, scale_x, scale_y = scale_x, alpha = 1) {

        if (!image.complete || !rect) {
            return
        }

        let w = rect[2] * scale_x
        let h = rect[3] * scale_y

        ctx.globalAlpha = alpha

        ctx.drawImage(
            image,
            rect[0], rect[1], rect[2], rect[3],
            Math.round(center_x - w / 2),
            Math.round(base_y - h),
            Math.max(1, Math.round(w)),
            Math.max(1, Math.round(h))
        )

        ctx.globalAlpha = 1

    }


    let draw_cloud = function(x, y, size, color) {

        ctx.fillStyle = color

        let blobs = [
            [0, 0, 11],
            [12, -5, 13],
            [26, 0, 10],
            [-11, 3, 8],
            [36, 4, 7]
        ]

        blobs.forEach(function(b) {
            ctx.beginPath()
            ctx.arc(Math.round(x + b[0] * size), Math.round(y + b[1] * size), Math.round(b[2] * size), 0, Math.PI * 2)
            ctx.fill()
        })

        ctx.fillRect(
            Math.round(x - 11 * size),
            Math.round(y),
            Math.round(54 * size),
            Math.round(8 * size)
        )

    }


    let draw_mound = function(health) {

        let soil = css(fade(hex_to_rgb("#7a5233"), 1 - health))
        let soil_light = css(fade(hex_to_rgb("#9b6c45"), 1 - health))

        ctx.fillStyle = soil
        ctx.fillRect(PLANT_X - 20, PLANT_BASE - 5, 40, 5)
        ctx.fillRect(PLANT_X - 15, PLANT_BASE - 9, 30, 4)
        ctx.fillStyle = soil_light
        ctx.fillRect(PLANT_X - 9, PLANT_BASE - 12, 18, 3)

    }


    let draw_seed = function(t, health) {

        draw_mound(health)

        // Tiny seed that wiggles a little
        let wiggle = Math.round(Math.sin(t * 2) * 0.6)

        ctx.fillStyle = css(fade(hex_to_rgb("#d9b26a"), 1 - health))
        ctx.fillRect(PLANT_X - 3 + wiggle, PLANT_BASE - 16, 6, 4)
        ctx.fillStyle = css(fade(hex_to_rgb("#8fc95a"), 1 - health))
        ctx.fillRect(PLANT_X + wiggle, PLANT_BASE - 19, 2, 3)

    }


    let render = function(t, dt) {

        let now = new Date()
        let hour = hour_override !== null
            ? hour_override
            : now.getHours() + now.getMinutes() / 60

        let health = state.vitality / 100

        if (mode === "thirsty") {
            health *= 0.7
        }

        let gloom = clamp((0.6 - health) / 0.6, 0, 1)
        let raining = mode === "break" || performance.now() < rain_burst_until

        let sky = sky_at(hour)
        let dark = sky.dark

        ctx.clearRect(0, 0, W, H)
        ctx.imageSmoothingEnabled = false


        // Sky
        let rain_gloom = raining ? 0.25 : 0
        let sky_gloom = clamp(gloom + rain_gloom, 0, 1)

        let gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
        gradient.addColorStop(0, css(fade(sky.top, sky_gloom)))
        gradient.addColorStop(1, css(fade(sky.bottom, sky_gloom)))
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, W, GROUND_Y + 10)


        // Stars
        if (dark > 0.3) {

            stars.forEach(function(star) {

                let twinkle = 0.55 + 0.45 * Math.sin(t * 1.6 + star.phase)
                let alpha = (dark - 0.3) / 0.7 * (1 - sky_gloom * 0.8) * twinkle

                ctx.fillStyle = "rgba(255,255,235," + alpha.toFixed(3) + ")"
                ctx.fillRect(star.x, star.y, star.size, star.size)

            })

        }


        // Sun
        if (hour >= 5.5 && hour <= 20) {

            let p = (hour - 5.5) / 14.5
            let sx = 18 + (W - 36) * p
            let sy = 82 - Math.sin(Math.PI * p) * 62
            let glow = (1 - sky_gloom * 0.85)

            ctx.fillStyle = "rgba(255,226,140," + (0.25 * glow).toFixed(3) + ")"
            ctx.beginPath()
            ctx.arc(sx, sy, 16, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = css(fade(hex_to_rgb("#ffd76a"), sky_gloom * 0.8), (0.4 + 0.6 * glow).toFixed(3))
            ctx.fillRect(Math.round(sx - 7), Math.round(sy - 5), 14, 10)
            ctx.fillRect(Math.round(sx - 5), Math.round(sy - 7), 10, 14)

        }


        // Moon
        if (hour >= 19.5 || hour <= 6.5) {

            let night_hour = hour >= 19.5 ? hour - 19.5 : hour + 4.5
            let p = night_hour / 11
            let mx = 18 + (W - 36) * p
            let my = 70 - Math.sin(Math.PI * p) * 50

            ctx.fillStyle = "rgba(240,240,220," + (0.9 - sky_gloom * 0.5).toFixed(3) + ")"
            ctx.fillRect(Math.round(mx - 5), Math.round(my - 4), 10, 8)
            ctx.fillRect(Math.round(mx - 4), Math.round(my - 5), 8, 10)
            ctx.fillStyle = css(fade(sky.top, sky_gloom))
            ctx.fillRect(Math.round(mx - 1), Math.round(my - 5), 6, 7)

        }


        // Clouds: more and darker when the plant is struggling
        let cloud_count = Math.min(clouds.length, 2 + Math.round(sky_gloom * 5))
        let cloud_color = mix(hex_to_rgb("#ffffff"), hex_to_rgb("#8b9098"), sky_gloom)
        cloud_color = mix(cloud_color, hex_to_rgb("#39405e"), dark * 0.7)

        for (let i = 0; i < cloud_count; i++) {

            let cloud = clouds[i]
            let x = ((cloud.offset + t * cloud.speed) % (W + 120)) - 60

            draw_cloud(x, cloud.y, cloud.size, css(cloud_color, 0.92))

        }


        // Far hills
        let lush_far = hex_to_rgb("#8cc77a")
        let dry_far = hex_to_rgb("#c7b98d")
        let far_color = fade(mix(dry_far, lush_far, health), gloom * 0.5)

        ctx.fillStyle = css(far_color)
        ctx.beginPath()
        ctx.moveTo(0, H)

        for (let x = 0; x <= W; x += 4) {
            ctx.lineTo(x, GROUND_Y - 14 + Math.sin(x * 0.021 + 1.2) * 8 + Math.sin(x * 0.053) * 3)
        }

        ctx.lineTo(W, H)
        ctx.fill()


        // Near ground
        let lush = hex_to_rgb("#5ea548")
        let dry = hex_to_rgb("#b09460")
        let ground_color = fade(mix(dry, lush, health), gloom * 0.4)

        ctx.fillStyle = css(ground_color)
        ctx.beginPath()
        ctx.moveTo(0, H)

        for (let x = 0; x <= W; x += 4) {
            ctx.lineTo(x, GROUND_Y + Math.sin(x * 0.03 + 0.5) * 2.5)
        }

        ctx.lineTo(W, H)
        ctx.fill()

        ctx.fillStyle = css(ground_color.map(function(c) { return c * 0.88 }))
        ctx.fillRect(0, H - 10, W, 10)


        // Grass and decorations
        ctx.filter = plant_filter(health)

        grass.forEach(function(item) {
            draw_sprite(flower_image, sprites.flowers[item.index], item.x, item.y, 2)
        })

        get_decorations(work_ms_on(new Date()), state.vitality).forEach(function(item) {
            draw_sprite(flower_image, sprites.flowers[item.index], item.x, item.y, item.scale)
        })


        // Plant
        let spec = plant_spec()

        if (!shown || shown.key !== spec.key) {

            previous_shown = shown
            shown = Object.assign({}, spec)
            shown.scale = previous_shown ? spec.scale * 0.8 : spec.scale
            transition_start = performance.now()

        }

        shown.rect = spec.rect
        shown.image = spec.image
        shown.scale += (spec.scale - shown.scale) * Math.min(1, dt * 2.5)

        let transition = clamp((performance.now() - transition_start) / TRANSITION_MS, 0, 1)

        let breathe = 1 + Math.sin(t * 1.4) * 0.008
        let droop = mode === "thirsty" ? 0.96 : 1

        if (previous_shown && transition < 1) {

            if (previous_shown.seed) {
                ctx.globalAlpha = 1 - transition
                draw_seed(t, health)
                ctx.globalAlpha = 1
            } else {
                draw_sprite(
                    previous_shown.image,
                    previous_shown.rect,
                    PLANT_X,
                    PLANT_BASE,
                    previous_shown.scale,
                    previous_shown.scale * droop,
                    1 - transition
                )
            }

        }

        if (shown.seed) {
            draw_seed(t, health)
        } else {
            if (shown.mound) {
                draw_mound(health)
            }

            draw_sprite(
                shown.image,
                shown.rect,
                PLANT_X,
                PLANT_BASE,
                shown.scale,
                shown.scale * breathe * droop,
                previous_shown ? transition : 1
            )
        }

        ctx.filter = "none"


        // Plant particles
        if (!shown.seed && shown.rect) {

            let crown = {
                width: shown.rect[2] * shown.scale * 0.8,
                height: shown.rect[3] * shown.scale,
                top: PLANT_BASE - shown.rect[3] * shown.scale
            }

            let def = PLANTS[state.plant]

            if (spec.stage >= 3 && state.vitality < 35 && state.vitality >= 12 && !def.no_leaves && Math.random() < dt * 0.8) {
                spawn_particle("leaf", crown)
            }

            if (spec.stage === 5 && state.vitality >= 50) {

                if (def.petals && Math.random() < dt * 1.5) {
                    spawn_particle("petal", crown)
                }

                else if (!def.petals && Math.random() < dt * 1.2) {
                    spawn_particle("sparkle", crown)
                }

            }

        }

        update_particles(dt, t)

        particles.forEach(function(p) {

            let alpha = clamp(1 - p.age / p.life, 0, 1)

            if (p.kind === "leaf") {
                ctx.fillStyle = "rgba(196,120,52," + alpha.toFixed(3) + ")"
                ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2)
            }

            else if (p.kind === "petal") {
                ctx.fillStyle = "rgba(255,183,206," + alpha.toFixed(3) + ")"
                ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1)
            }

            else {
                let a = alpha * (0.5 + 0.5 * Math.sin(t * 8 + p.phase))
                ctx.fillStyle = "rgba(255,240,150," + a.toFixed(3) + ")"
                ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3)
                ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1)
            }

        })


        // Night tint over the ground and plant
        if (dark > 0) {

            let tint = ctx.createLinearGradient(0, GROUND_Y - 45, 0, GROUND_Y)
            let alpha = (dark * 0.42).toFixed(3)

            tint.addColorStop(0, "rgba(14,20,52,0)")
            tint.addColorStop(1, "rgba(14,20,52," + alpha + ")")

            ctx.fillStyle = tint
            ctx.fillRect(0, GROUND_Y - 45, W, 45)

            ctx.fillStyle = "rgba(14,20,52," + alpha + ")"
            ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)

        }


        // Fireflies on healthy nights
        if (dark > 0.5 && health > 0.5) {

            fireflies.forEach(function(fly) {

                fly.x += Math.cos(t * fly.speed + fly.phase) * 6 * dt
                fly.y += Math.sin(t * fly.speed * 1.3 + fly.phase) * 4 * dt

                if (fly.x < 0) { fly.x = W }
                if (fly.x > W) { fly.x = 0 }

                let glow = 0.5 + 0.5 * Math.sin(t * 2.2 + fly.phase)

                ctx.fillStyle = "rgba(230,255,140," + (glow * (dark - 0.5) * 2).toFixed(3) + ")"
                ctx.fillRect(Math.round(fly.x), Math.round(fly.y), 2, 2)

            })

        }


        // Rain
        update_rain(raining, dt)

        if (rain.length > 0) {

            ctx.fillStyle = "rgba(180,210,255,0.65)"

            rain.forEach(function(drop) {
                ctx.fillRect(Math.round(drop.x), Math.round(drop.y), 1, 4)
            })

        }

    }


    // =================================
    // INFO BAR
    // =================================

    let last_info = ""

    let update_info = function() {

        if (!title_element) {
            return
        }

        let def = PLANTS[state.plant]
        let stage = STAGES[stage_index()]
        let growth = Math.floor(growth_fraction() * 100)
        let vitality = Math.round(state.vitality)

        let mood = vitality >= 70
            ? "thriving"
            : vitality >= 40
                ? "doing okay"
                : vitality >= 12
                    ? "fading"
                    : "withered"

        let info = def.name + "|" + stage.name + "|" + growth + "|" + vitality + "|" + mood

        if (info === last_info) {
            return
        }

        last_info = info

        title_element.textContent = def.name + " · " + stage.name + " · " + mood

        growth_bar.style.width = growth + "%"
        vitality_bar.style.width = vitality + "%"

        growth_label.textContent = growth + "%"
        vitality_label.textContent = vitality + "%"

        garden_element.classList.toggle("garden-low", vitality < 35)

    }


    // =================================
    // ANIMATION LOOP
    // =================================

    let last_frame = 0
    let last_save = Date.now()

    let frame = function(timestamp) {

        requestAnimationFrame(frame)

        // About 24 frames per second is enough for the pixel scene
        if (timestamp - last_frame < 40) {
            return
        }

        let dt = last_frame ? Math.min(0.2, (timestamp - last_frame) / 1000) : 0.04
        last_frame = timestamp

        update_state()

        if (Date.now() - last_save > 15000) {
            last_save = Date.now()
            save_state()
            save_stats()
        }

        if (!canvas || !canvas.isConnected || garden_element.hidden || document.hidden) {
            return
        }

        render(timestamp / 1000, dt)
        update_info()

    }


    // Background tabs pause requestAnimationFrame, so keep decay
    // and saving going with a slow timer as well.
    setInterval(function() {

        update_state()
        save_state()
        save_stats()

    }, 60000)


    // =================================
    // SETUP AND MOUNTING
    // =================================

    let resize_canvas = function() {

        let ratio = window.devicePixelRatio || 1

        canvas.width = Math.round(W * ratio)
        canvas.height = Math.round(H * ratio)

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.imageSmoothingEnabled = false

    }


    let init = function(element) {

        garden_element = element
        canvas = element.querySelector("canvas")
        ctx = canvas.getContext("2d")

        title_element = element.querySelector(".garden-title")
        growth_bar = element.querySelector(".growth-bar")
        vitality_bar = element.querySelector(".vitality-bar")
        growth_label = element.querySelector(".growth-value")
        vitality_label = element.querySelector(".vitality-value")

        resize_canvas()

        window.addEventListener("resize", resize_canvas)

        window.addEventListener("beforeunload", function() {
            update_state()
            save_state()
            save_stats()
        })

        requestAnimationFrame(frame)

    }


    let mount = function(slot) {

        if (!garden_element) {
            return
        }

        if (slot && garden_element.parentElement !== slot) {
            slot.appendChild(garden_element)
        }

        garden_element.hidden = !slot

    }


    // Small preview of a plant (used in the stats garden)
    let draw_plant_icon = function(target, type) {

        let def = PLANTS[type]

        if (!def) {
            return
        }

        let rect = tree_rect(def.bloom)
        let size = target.width
        let icon_ctx = target.getContext("2d")

        let paint = function() {

            icon_ctx.clearRect(0, 0, size, size)
            icon_ctx.imageSmoothingEnabled = false

            let scale = Math.min((size - 4) / rect[2], (size - 4) / rect[3])
            let w = rect[2] * scale
            let h = rect[3] * scale

            icon_ctx.drawImage(
                tree_image,
                rect[0], rect[1], rect[2], rect[3],
                Math.round((size - w) / 2), Math.round(size - h - 2),
                Math.round(w), Math.round(h)
            )

        }

        if (tree_image.complete) {
            paint()
        } else {
            tree_image.addEventListener("load", paint, { once: true })
        }

    }


    // =================================
    // PUBLIC API
    // =================================

    window.BloomGarden = {

        PLANTS: PLANTS,
        STAGES: STAGES,
        GROW_FULL_MS: GROW_FULL_MS,

        init: init,
        mount: mount,
        set_mode: set_mode,

        add_work: add_work,
        record_session: record_session,
        water: water,

        set_plant: set_plant,
        get_plant: function() { return state.plant },

        is_fully_grown: function() { return growth_fraction() >= 1 },
        plant_new_seed: plant_new_seed,
        get_completed: function() { return state.completed.slice() },

        get_summary: get_summary,
        get_daily_series: get_daily_series,
        get_weekly_series: get_weekly_series,

        draw_plant_icon: draw_plant_icon,

        on_change: function(listener) { change_listeners.push(listener) },

        save: function() {
            update_state()
            save_state()
            save_stats()
        },


        // =================================
        // TEST PANEL HELPERS (beta only)
        // =================================

        debug: {

            get: function() {
                return {
                    growth: growth_fraction() * 100,
                    vitality: state.vitality,
                    hour: hour_override,
                    plant: state.plant,
                    today_minutes: Math.round(work_ms_on(new Date()) / 60000)
                }
            },

            set_growth: function(percent) {
                state.growth_ms = clamp(percent / 100, 0, 1) * GROW_FULL_MS
                save_state()
                notify_change("debug")
            },

            set_vitality: function(value) {
                state.vitality = clamp(value, 0, 100)
                save_state()
                notify_change("debug")
            },

            set_hour: function(hour) {
                hour_override = hour === null ? null : clamp(hour, 0, 23.99)
            },

            set_today_minutes: function(minutes) {
                get_day(day_key()).work_ms = Math.max(0, minutes) * 60000
                save_stats()
            },

            simulate_idle: function(hours) {
                state.vitality = clamp(
                    state.vitality - hours * 3600000 / WITHER_MS * 100,
                    0,
                    100
                )
                save_state()
                notify_change("debug")
            },

            rain: function(seconds) {
                rain_burst_until = performance.now() + seconds * 1000
            },

            reset: function() {
                [STATE_KEY, STATS_KEY, "bloombreak-settings", "bloombreak-session"].forEach(function(key) {
                    localStorage.removeItem(key)
                })
                // Do not let the unload handler write the old state back
                Storage.prototype.setItem = function() {}
                location.reload()
            }

        }

    }

})()
