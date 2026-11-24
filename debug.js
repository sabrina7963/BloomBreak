
// =================================
// BETA TEST PANEL
// =================================

// Hidden panel for testers. Opens with Ctrl+Shift+D,
// only in beta builds (or when running from source).

(function() {

    let garden = window.BloomGarden
    let panel = null


    // =================================
    // PANEL MARKUP
    // =================================

    let PANEL_HTML = `
        <div class="debug-header">
            <strong>Test panel</strong>
            <button type="button" class="debug-close" data-action="close" aria-label="Close">✕</button>
        </div>

        <label class="debug-row">
            <span>Time of day <b data-out="hour">real</b></span>
            <input type="range" min="0" max="23.75" step="0.25" data-input="hour">
        </label>
        <label class="debug-check">
            <input type="checkbox" data-input="real-time" checked> Use real clock
        </label>

        <label class="debug-row">
            <span>Growth <b data-out="growth">0%</b></span>
            <input type="range" min="0" max="100" step="1" data-input="growth">
        </label>

        <div class="debug-buttons">
            <button type="button" data-growth="0">Seed</button>
            <button type="button" data-growth="8">Sprout</button>
            <button type="button" data-growth="25">Sapling</button>
            <button type="button" data-growth="50">Young</button>
            <button type="button" data-growth="80">Mature</button>
            <button type="button" data-growth="100">Full</button>
        </div>

        <label class="debug-row">
            <span>Vitality <b data-out="vitality">0%</b></span>
            <input type="range" min="0" max="100" step="1" data-input="vitality">
        </label>

        <label class="debug-row">
            <span>Today's focus <b data-out="today">0m</b></span>
            <input type="range" min="0" max="300" step="5" data-input="today">
        </label>

        <label class="debug-row">
            <span>Plant</span>
            <select data-input="plant"></select>
        </label>

        <div class="debug-buttons">
            <button type="button" data-action="idle">Idle +12h</button>
            <button type="button" data-action="rain">Rain 10s</button>
            <button type="button" data-action="skip">Timer → 3s left</button>
        </div>

        <div class="debug-buttons">
            <button type="button" data-action="reset" class="debug-danger">Reset all data</button>
        </div>

        <p class="debug-note">Changes are saved like real progress. Use "Reset all data" to start over.</p>
    `


    // =================================
    // HELPERS
    // =================================

    let format_hour = function(hour) {

        let h = Math.floor(hour)
        let m = Math.round((hour - h) * 60)

        return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0")

    }

    let input = function(name) {
        return panel.querySelector('[data-input="' + name + '"]')
    }

    let output = function(name) {
        return panel.querySelector('[data-out="' + name + '"]')
    }


    let refresh = function() {

        let data = garden.debug.get()

        input("growth").value = Math.round(data.growth)
        output("growth").textContent = Math.round(data.growth) + "%"

        input("vitality").value = Math.round(data.vitality)
        output("vitality").textContent = Math.round(data.vitality) + "%"

        input("today").value = data.today_minutes
        output("today").textContent = data.today_minutes + "m"

        input("plant").value = data.plant

        let real = data.hour === null
        let now = new Date()

        input("real-time").checked = real
        input("hour").value = real ? now.getHours() + now.getMinutes() / 60 : data.hour
        output("hour").textContent = real ? "real" : format_hour(data.hour)

    }


    // Make the next timer tick finish the phase in a few seconds
    let skip_timer = function() {

        if (active_timer === null || phase_started_at === null) {
            alert("Start a work or break timer first.")
            return
        }

        let remaining = 3000
        let target_elapsed = Math.max(0, phase_duration_ms - remaining)

        // Move the start time back; credit_work ignores large jumps
        phase_started_at = Date.now() - (target_elapsed - phase_elapsed_ms)

        save_session()

    }


    // =================================
    // BUILD PANEL
    // =================================

    let build = function() {

        panel = document.createElement("div")
        panel.className = "debug-panel"
        panel.hidden = true
        panel.innerHTML = PANEL_HTML

        let plant_select = input("plant")

        Object.keys(garden.PLANTS).forEach(function(key) {
            let option = document.createElement("option")
            option.value = key
            option.textContent = garden.PLANTS[key].name
            plant_select.appendChild(option)
        })

        document.body.appendChild(panel)


        panel.addEventListener("input", function(event) {

            let name = event.target.dataset.input
            let value = Number(event.target.value)

            if (name === "hour") {
                garden.debug.set_hour(value)
            }

            else if (name === "real-time") {
                garden.debug.set_hour(event.target.checked ? null : Number(input("hour").value))
            }

            else if (name === "growth") {
                garden.debug.set_growth(value)
            }

            else if (name === "vitality") {
                garden.debug.set_vitality(value)
            }

            else if (name === "today") {
                garden.debug.set_today_minutes(value)
            }

            else if (name === "plant") {
                garden.set_plant(event.target.value)
                plant_type.value = event.target.value
            }

            refresh()

            if (welcome_screen.classList.contains("active")) {
                update_welcome()
            }

        })


        panel.addEventListener("click", function(event) {

            let button = event.target.closest("button")

            if (!button) {
                return
            }

            if (button.dataset.growth !== undefined) {
                garden.debug.set_growth(Number(button.dataset.growth))
            }

            let action = button.dataset.action

            if (action === "close") {
                panel.hidden = true
            }

            else if (action === "idle") {
                garden.debug.simulate_idle(12)
            }

            else if (action === "rain") {
                garden.debug.rain(10)
            }

            else if (action === "skip") {
                skip_timer()
            }

            else if (action === "reset") {
                if (confirm("Reset growth, vitality, stats, settings and the current session?")) {
                    garden.debug.reset()
                }
                return
            }

            refresh()

            if (welcome_screen.classList.contains("active")) {
                update_welcome()
            }

        })


        document.addEventListener("keydown", function(event) {

            // event.code works with any keyboard layout (AZ, RU, ...)
            if (event.ctrlKey && event.shiftKey && event.code === "KeyD") {

                event.preventDefault()

                panel.hidden = !panel.hidden

                if (!panel.hidden) {
                    refresh()
                }

            }

        })


        // Keep values in sync while the panel is open
        setInterval(function() {
            if (!panel.hidden && !panel.contains(document.activeElement)) {
                refresh()
            }
        }, 2000)

    }


    // =================================
    // ENABLE ONLY FOR BETA BUILDS
    // =================================

    if (window.bloomAPI && typeof window.bloomAPI.getAppInfo === "function") {

        window.bloomAPI.getAppInfo()
            .then(function(info) {

                let version = info && typeof info.version === "string" ? info.version : ""

                if (/beta|alpha|dev/i.test(version) || (info && info.packaged === false)) {
                    build()
                }

            })
            .catch(function() {})

    }

})()
