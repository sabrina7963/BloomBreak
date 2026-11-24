
// =================================
// BUTTONS
// =================================

let water_button = document.getElementById("water-button")
let start_button = document.getElementById("start-button")
let new_seed_button = document.getElementById("new-seed-button")
let stats_button = document.getElementById("stats-button")
let stats_back_button = document.getElementById("stats-back-button")

let welcome_settings_button = document.getElementById("welcome-settings-button")
let work_settings_button = document.getElementById("work-settings-button")
let break_settings_button = document.getElementById("break-settings-button")

let back_to_work_button = document.getElementById("back-to-work-button")
let extend_break_button = document.getElementById("extend-break-button")

let extend_save_button = document.getElementById("extend-save-button")
let extend_back_button = document.getElementById("extend-back-button")

let save_button = document.getElementById("save-button")
let back_button = document.getElementById("back-button")

let pause_buttons = document.querySelectorAll(".pause-button")
let end_buttons = document.querySelectorAll(".end-button")


// =================================
// SCREENS
// =================================

let welcome_screen = document.getElementById("welcome-screen")
let work_screen = document.getElementById("work-screen")
let water_screen = document.getElementById("water-screen")
let approval_screen = document.getElementById("approval-screen")
let extend_break_screen = document.getElementById("extend-break-screen")
let break_screen = document.getElementById("break-screen")
let settings_screen = document.getElementById("settings-screen")
let stats_screen = document.getElementById("stats-screen")

let previous_screen = welcome_screen

let welcome_title = document.getElementById("welcome-title")
let welcome_description = document.getElementById("welcome-description")


// =================================
// GARDEN
// =================================

let garden = window.BloomGarden

garden.init(document.getElementById("garden"))


let show_screen = function(screen) {

    document.querySelectorAll(".screen").forEach(function(item) {
        item.classList.remove("active")
    })

    screen.classList.add("active")

    // Move the shared garden into the new screen (if it has a slot)
    garden.mount(screen.querySelector(".garden-slot"))

    if (screen === welcome_screen) {
        update_welcome()
    }

    if (screen === stats_screen) {
        window.BloomStats.render()
    }

    update_garden_mode()
    save_session()
}


// Tell the garden what the user is doing right now
let update_garden_mode = function() {

    let mode = "idle"

    if (active_timer !== null && current_phase === "work") {
        mode = "work"
    }

    else if (active_timer !== null && current_phase === "break") {
        mode = "break"
    }

    else if (can_water === true) {
        mode = "thirsty"
    }

    garden.set_mode(mode)

}


let update_welcome = function() {

    let plant_name = garden.PLANTS[garden.get_plant()].name

    if (garden.is_fully_grown()) {

        new_seed_button.hidden = false

        welcome_title.textContent = "Your " + plant_name + " is fully grown! 🎉"
        welcome_description.textContent =
            "Plant a new seed to grow the next one. Your grown plant moves to your collection in Stats."

    } else {

        new_seed_button.hidden = true

        welcome_title.textContent = "Welcome to BloomBreak!"
        welcome_description.textContent =
            "Focus to help your plant grow. A little pause helps you bloom."

    }

}


garden.on_change(function() {

    if (welcome_screen.classList.contains("active")) {
        update_welcome()
    }

})


// =================================
// COUNTDOWNS
// =================================

let work_countdown = document.getElementById("work-countdown")
let break_countdown = document.getElementById("break-countdown")


// =================================
// SETTINGS INPUTS
// =================================

let work_duration = document.getElementById("work-duration")
let break_duration = document.getElementById("break-duration")

let work_unit = document.getElementById("work-unit")
let break_unit = document.getElementById("break-unit")

let sound_toggle = document.getElementById("sound-toggle")


// =================================
// EXTENSION INPUTS
// =================================

let extend_duration = document.getElementById("extend-duration")
let extend_unit = document.getElementById("extend-unit")


// =================================
// PLANT SETTINGS
// =================================

let plant_type = document.getElementById("plant-type")


// =================================
// TIMER SETTINGS
// =================================

let can_water = false

// Work duration
let work_duration_value = 20
let work_duration_unit = "minutes"
let work_ms = 20 * 60 * 1000

// Break duration
let break_duration_value = 5
let break_duration_unit = "minutes"
let break_ms = 5 * 60 * 1000

let current_phase = "work"

let active_timer = null
let seconds_left

let is_paused = false

let phase_duration_ms = 0
let phase_elapsed_ms = 0
let phase_started_at = null

let was_paused_before_settings = false
let settings_open = false

let current_break_is_extension = false

// Work time already given to the garden in this work phase
let work_credit_at = null
let work_credited_ms = 0

let sound_enabled = true


// =================================
// DURATION LIMITS
// =================================

let UNITS = ["seconds", "minutes", "hours"]

let MAX_WORK_MS = 12 * 60 * 60 * 1000
let MAX_BREAK_MS = 4 * 60 * 60 * 1000


// =================================
// DURATION CONVERSION
// =================================

let convert_to_ms = function(value, unit) {

    if (unit === "seconds") {
        return value * 1000
    }

    else if (unit === "minutes") {
        return value * 60 * 1000
    }

    else if (unit === "hours") {
        return value * 60 * 60 * 1000
    }

}


let describe_limit = function(ms) {

    let hours = ms / (60 * 60 * 1000)

    return hours === 1 ? "1 hour" : hours + " hours"

}


// Returns { value, ms } or { error }
let validate_duration = function(raw_value, unit, max_ms, label) {

    let text = String(raw_value).trim()

    if (!/^\d+$/.test(text) || Number(text) <= 0) {
        return { error: label + " must be a positive whole number." }
    }

    if (!UNITS.includes(unit)) {
        return { error: label + " has an invalid unit." }
    }

    let value = Number(text)
    let ms = convert_to_ms(value, unit)

    if (text.length > 9 || !Number.isSafeInteger(ms) || ms > max_ms) {
        return { error: label + " can be at most " + describe_limit(max_ms) + "." }
    }

    return { value: value, ms: ms }

}


// =================================
// SAVED SETTINGS
// =================================

let SETTINGS_KEY = "bloombreak-settings"


let save_settings = function() {

    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            work_value: work_duration_value,
            work_unit: work_duration_unit,
            break_value: break_duration_value,
            break_unit: break_duration_unit,
            sound: sound_enabled
        }))
    } catch (error) {
        console.error("Could not save settings:", error)
    }

}


let load_settings = function() {

    let saved = null

    try {
        saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
    } catch (error) {
        saved = null
    }

    if (!saved || typeof saved !== "object") {
        return
    }

    let work = validate_duration(saved.work_value, saved.work_unit, MAX_WORK_MS, "Work duration")
    let rest = validate_duration(saved.break_value, saved.break_unit, MAX_BREAK_MS, "Break duration")

    if (!work.error) {
        work_duration_value = work.value
        work_duration_unit = saved.work_unit
        work_ms = work.ms
    }

    if (!rest.error) {
        break_duration_value = rest.value
        break_duration_unit = saved.break_unit
        break_ms = rest.ms
    }

    if (typeof saved.sound === "boolean") {
        sound_enabled = saved.sound
    }

}


// =================================
// SESSION RECOVERY
// =================================

// The running timer is saved so it can be restored if the
// app is closed unexpectedly.

let SESSION_KEY = "bloombreak-session"


let save_session = function() {

    let active = document.querySelector(".screen.active")

    let screen = settings_open || active === stats_screen
        ? previous_screen
        : active

    try {

        if (!screen || screen === welcome_screen || screen === stats_screen) {
            localStorage.removeItem(SESSION_KEY)
            return
        }

        localStorage.setItem(SESSION_KEY, JSON.stringify({
            screen: screen.id,
            phase: current_phase,
            duration_ms: phase_duration_ms,
            elapsed_ms: phase_elapsed_ms,
            started_at: phase_started_at,
            paused: is_paused,
            is_extension: current_break_is_extension,
            can_water: can_water,
            credited_ms: work_credited_ms
        }))

    } catch (error) {
        console.error("Could not save session:", error)
    }

}


let restore_session = function() {

    let data = null

    try {
        data = JSON.parse(localStorage.getItem(SESSION_KEY))
    } catch (error) {
        data = null
    }

    if (!data || typeof data !== "object") {
        return false
    }

    let screen = document.getElementById(data.screen)

    let valid =
        [work_screen, break_screen, water_screen, approval_screen, extend_break_screen].includes(screen) &&
        ["work", "break"].includes(data.phase) &&
        Number.isFinite(data.duration_ms) && data.duration_ms > 0 &&
        data.duration_ms <= Math.max(MAX_WORK_MS, MAX_BREAK_MS) &&
        Number.isFinite(data.elapsed_ms) && data.elapsed_ms >= 0

    if (!valid) {
        localStorage.removeItem(SESSION_KEY)
        return false
    }

    current_phase = data.phase
    phase_duration_ms = data.duration_ms
    current_break_is_extension = data.is_extension === true
    work_credited_ms = Number.isFinite(data.credited_ms) ? data.credited_ms : data.elapsed_ms


    // Waiting screens
    if (screen === water_screen) {

        current_phase = "work"
        can_water = true
        seconds_left = 0

        show_screen(water_screen)
        return true

    }

    if (screen === approval_screen || screen === extend_break_screen) {

        current_phase = "break"
        seconds_left = 0

        show_screen(approval_screen)
        return true

    }


    // Running or paused timers
    let running_for = 0

    if (
        data.paused !== true &&
        Number.isFinite(data.started_at) &&
        data.started_at <= Date.now()
    ) {
        running_for = Date.now() - data.started_at
    }

    let elapsed = data.elapsed_ms + running_for

    phase_elapsed_ms = Math.min(elapsed, phase_duration_ms)
    seconds_left = Math.ceil((phase_duration_ms - phase_elapsed_ms) / 1000)

    show_screen(screen)

    if (phase_elapsed_ms >= phase_duration_ms) {
        finish_phase()
        return true
    }

    if (data.paused === true) {

        is_paused = true

        pause_buttons.forEach(function(btn) {
            btn.textContent = "Resume"
        })

        update_countdown()
        save_session()

    } else {

        update_countdown()
        run_timer()

    }

    return true

}


// =================================
// NOTIFICATION SOUND
// =================================

let audio_context = null


let play_chime = function(next_phase) {

    if (!sound_enabled) {
        return
    }

    try {

        audio_context = audio_context || new AudioContext()

        let notes = next_phase === "break"
            ? [659.25, 783.99, 1046.5]
            : [523.25, 659.25, 783.99]

        let start = audio_context.currentTime + 0.05

        notes.forEach(function(frequency, index) {

            let oscillator = audio_context.createOscillator()
            let gain = audio_context.createGain()

            let t = start + index * 0.17

            oscillator.type = "sine"
            oscillator.frequency.value = frequency

            gain.gain.setValueAtTime(0, t)
            gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7)

            oscillator.connect(gain)
            gain.connect(audio_context.destination)

            oscillator.start(t)
            oscillator.stop(t + 0.75)

        })

    } catch (error) {
        console.error("Could not play chime:", error)
    }

}


// =================================
// TIMER DISPLAY
// =================================

let format_time = function(
    total_seconds,
    duration_ms = phase_duration_ms
) {

    // Use HH:MM:SS for durations longer than 60 minutes
    if (duration_ms > 60 * 60 * 1000) {

        let hours = Math.floor(total_seconds / 3600)
        let minutes = Math.floor((total_seconds % 3600) / 60)
        let seconds = total_seconds % 60

        return (
            hours.toString().padStart(2, "0") + ":" +
            minutes.toString().padStart(2, "0") + ":" +
            seconds.toString().padStart(2, "0")
        )

    }

    // Use MM:SS for durations of 60 minutes or less
    let minutes = Math.floor(total_seconds / 60)
    let seconds = total_seconds % 60

    return (
        minutes.toString().padStart(2, "0") + ":" +
        seconds.toString().padStart(2, "0")
    )

}


let update_countdown = function() {

    let countdown = current_phase === "work"
        ? work_countdown
        : break_countdown

    countdown.textContent = format_time(seconds_left)

}


let update_idle_countdowns = function() {

    work_countdown.textContent =
        format_time(Math.ceil(work_ms / 1000), work_ms)

    break_countdown.textContent =
        format_time(Math.ceil(break_ms / 1000), break_ms)

}


// =================================
// GARDEN WORK CREDIT
// =================================

let credit_work = function() {

    if (
        current_phase !== "work" ||
        phase_started_at === null ||
        work_credit_at === null
    ) {
        return
    }

    let now = Date.now()
    let delta = now - work_credit_at

    work_credit_at = now

    // Ignore large jumps (for example when the computer was asleep)
    if (delta <= 0 || delta > 10000) {
        return
    }

    delta = Math.min(delta, phase_duration_ms - work_credited_ms)

    if (delta > 0) {
        work_credited_ms += delta
        garden.add_work(delta)
    }

}


// =================================
// FINISH PHASE
// =================================

let finish_phase = function() {

    credit_work()

    clearInterval(active_timer)
    active_timer = null
    phase_started_at = null
    work_credit_at = null

    seconds_left = 0
    update_countdown()

    // Show desktop notification when a timer phase finishes
    let next_phase = current_phase === "work"
        ? "break"
        : "work"

    play_chime(next_phase)

    window.bloomAPI.showPhaseNotification(next_phase, sound_enabled)
        .catch(function(error) {
            console.error("Could not show desktop notification:", error)
        })

    is_paused = false

    pause_buttons.forEach(function(btn) {
        btn.textContent = "Pause"
    })

    if (current_phase === "work") {

        garden.record_session()

        can_water = true

        if (settings_open) {
            previous_screen = water_screen
        } else {
            show_screen(water_screen)
        }

    } else {

        current_break_is_extension = false

        if (settings_open) {
            previous_screen = approval_screen
        } else {
            show_screen(approval_screen)
        }

    }

    update_garden_mode()
    save_session()

}


// =================================
// RUN TIMER
// =================================

let run_timer = function() {

    clearInterval(active_timer)

    phase_started_at = Date.now()
    work_credit_at = current_phase === "work" ? phase_started_at : null

    active_timer = setInterval(function() {

        credit_work()

        let elapsed_time =
            phase_elapsed_ms + (Date.now() - phase_started_at)

        seconds_left = Math.ceil(
            (phase_duration_ms - elapsed_time) / 1000
        )

        if (seconds_left <= 0) {

            phase_elapsed_ms = phase_duration_ms
            finish_phase()

        } else {

            update_countdown()

        }

    }, 250)

    update_garden_mode()
    save_session()

}


// Pause the running timer and remember elapsed time
let pause_timer = function() {

    credit_work()

    clearInterval(active_timer)
    active_timer = null

    phase_elapsed_ms += Date.now() - phase_started_at
    phase_started_at = null
    work_credit_at = null

    is_paused = true

    update_garden_mode()
    save_session()

}


// =================================
// START WORK TIMER
// =================================

let start_timer = function() {

    current_phase = "work"
    current_break_is_extension = false
    can_water = false

    phase_duration_ms = work_ms
    phase_elapsed_ms = 0
    work_credited_ms = 0

    seconds_left = phase_duration_ms / 1000

    update_countdown()
    run_timer()

}


// =================================
// START BREAK TIMER
// =================================

let start_break = function(
    duration_ms = break_ms,
    is_extension = false
) {

    current_phase = "break"

    current_break_is_extension = is_extension

    phase_duration_ms = duration_ms
    phase_elapsed_ms = 0

    seconds_left = phase_duration_ms / 1000

    update_countdown()
    run_timer()

}


// =================================
// START WORK BUTTON
// =================================

start_button.addEventListener("click", function() {

    show_screen(work_screen)
    start_timer()

})


// =================================
// NEW SEED AND STATS BUTTONS
// =================================

new_seed_button.addEventListener("click", function() {

    garden.plant_new_seed()
    update_welcome()

})


stats_button.addEventListener("click", function() {

    previous_screen = welcome_screen
    show_screen(stats_screen)

})


stats_back_button.addEventListener("click", function() {

    show_screen(welcome_screen)

})


// =================================
// WATER BUTTON
// =================================

water_button.addEventListener("click", function() {

    if (can_water === true) {

        can_water = false

        garden.water()

        show_screen(break_screen)
        start_break()

    }

})


// =================================
// APPROVAL SCREEN BEHAVIOR
// =================================

// Back to Work
back_to_work_button.addEventListener("click", function() {

    show_screen(work_screen)
    start_timer()

})


// Open Extend Break screen
extend_break_button.addEventListener("click", function() {

    extend_duration.value = break_duration_value
    extend_unit.value = break_duration_unit

    show_screen(extend_break_screen)

})


// =================================
// EXTEND BREAK BEHAVIOR
// =================================

// Back button: return without saving
extend_back_button.addEventListener("click", function() {

    show_screen(approval_screen)

})


// Save button: start an extended break
extend_save_button.addEventListener("click", function() {

    let extension = validate_duration(
        extend_duration.value,
        extend_unit.value,
        MAX_BREAK_MS,
        "Break extension"
    )

    if (extension.error) {
        alert(extension.error)
        return
    }

    show_screen(break_screen)

    start_break(extension.ms, true)

})


// =================================
// SETTINGS BEHAVIOR
// =================================

let open_settings = function(screen) {

    previous_screen = screen

    work_duration.value = work_duration_value
    work_unit.value = work_duration_unit

    break_duration.value = break_duration_value
    break_unit.value = break_duration_unit

    plant_type.value = garden.get_plant()
    sound_toggle.checked = sound_enabled

    was_paused_before_settings = is_paused

    if (
        (screen === work_screen || screen === break_screen) &&
        is_paused === false &&
        active_timer !== null
    ) {

        pause_timer()

    }

    settings_open = true

    load_custom_themes()

    show_screen(settings_screen)

}


let close_settings = function() {

    settings_open = false

    show_screen(previous_screen)

    if (
        was_paused_before_settings === false &&
        is_paused === true
    ) {

        is_paused = false

        run_timer()

        pause_buttons.forEach(function(btn) {
            btn.textContent = "Pause"
        })

    }

}


// =================================
// SETTINGS NAVIGATION
// =================================

welcome_settings_button.addEventListener("click", function() {
    open_settings(welcome_screen)
})

work_settings_button.addEventListener("click", function() {
    open_settings(work_screen)
})

break_settings_button.addEventListener("click", function() {
    open_settings(break_screen)
})


// =================================
// SETTINGS BACK BUTTON
// =================================

back_button.addEventListener("click", function() {

    work_duration.value = work_duration_value
    work_unit.value = work_duration_unit

    break_duration.value = break_duration_value
    break_unit.value = break_duration_unit

    plant_type.value = garden.get_plant()
    sound_toggle.checked = sound_enabled

    close_settings()

})


// =================================
// SETTINGS SAVE BUTTON
// =================================

save_button.addEventListener("click", function() {

    let new_plant_type = plant_type.value

    if (!Object.hasOwn(garden.PLANTS, new_plant_type)) {
        alert("Please choose a valid plant.")
        return
    }

    let work = validate_duration(
        work_duration.value,
        work_unit.value,
        MAX_WORK_MS,
        "Work duration"
    )

    if (work.error) {
        alert(work.error)
        return
    }

    let rest = validate_duration(
        break_duration.value,
        break_unit.value,
        MAX_BREAK_MS,
        "Break duration"
    )

    if (rest.error) {
        alert(rest.error)
        return
    }

    // Save regular settings
    work_duration_value = work.value
    work_duration_unit = work_unit.value

    break_duration_value = rest.value
    break_duration_unit = break_unit.value

    work_ms = work.ms
    break_ms = rest.ms

    sound_enabled = sound_toggle.checked

    garden.set_plant(new_plant_type)

    save_settings()


    // Update active work timer if necessary
    if (
        previous_screen === work_screen &&
        current_phase === "work"
    ) {

        phase_duration_ms = work_ms

        let remaining_time =
            phase_duration_ms - phase_elapsed_ms

        if (remaining_time <= 0) {

            phase_elapsed_ms = phase_duration_ms
            finish_phase()

        } else {

            seconds_left = Math.ceil(remaining_time / 1000)
            update_countdown()

        }

    }

    // Update regular break timer only.
    // An extended break keeps its selected duration.
    else if (
        previous_screen === break_screen &&
        current_phase === "break" &&
        current_break_is_extension === false
    ) {

        phase_duration_ms = break_ms

        let remaining_time =
            phase_duration_ms - phase_elapsed_ms

        if (remaining_time <= 0) {

            phase_elapsed_ms = phase_duration_ms
            finish_phase()

        } else {

            seconds_left = Math.ceil(remaining_time / 1000)
            update_countdown()

        }

    }


    // Update initial countdown displays
    else if (previous_screen === welcome_screen) {

        update_idle_countdowns()

    }


    close_settings()

})


// =================================
// PAUSE / RESUME BEHAVIOR
// =================================

pause_buttons.forEach(function(button) {

    button.addEventListener("click", function() {

        if (is_paused === false) {

            pause_timer()

            pause_buttons.forEach(function(btn) {
                btn.textContent = "Resume"
            })

        } else {

            is_paused = false

            run_timer()

            pause_buttons.forEach(function(btn) {
                btn.textContent = "Pause"
            })

        }

    })

})


// =================================
// END SESSION BEHAVIOR
// =================================

end_buttons.forEach(function(button) {

    button.addEventListener("click", function() {

        credit_work()

        clearInterval(active_timer)
        active_timer = null

        phase_started_at = null
        phase_elapsed_ms = 0
        phase_duration_ms = 0
        work_credit_at = null
        work_credited_ms = 0

        seconds_left = undefined

        is_paused = false
        can_water = false

        settings_open = false
        was_paused_before_settings = false

        current_break_is_extension = false

        pause_buttons.forEach(function(btn) {
            btn.textContent = "Pause"
        })

        update_idle_countdowns()

        show_screen(welcome_screen)

        garden.save()

    })

})


// =================================
// ENTER KEY BEHAVIOR
// =================================

document.addEventListener("keydown", function(event) {

    if (
        event.key !== "Enter" ||
        event.repeat ||
        event.isComposing
    ) {
        return
    }

    if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey
    ) {
        return
    }

    if (event.target.closest("button")) {
        return
    }

    let active_screen = document.querySelector(".screen.active")


    if (active_screen === welcome_screen) {

        event.preventDefault()
        start_button.click()

    }

    else if (active_screen === settings_screen) {

        if (event.target.matches("input")) {

            event.preventDefault()
            save_button.click()

        }

    }

    else if (active_screen === water_screen) {

        event.preventDefault()
        water_button.click()

    }

    else if (active_screen === approval_screen) {

        event.preventDefault()
        back_to_work_button.click()

    }

    else if (active_screen === extend_break_screen) {

        if (event.target.matches("input")) {

            event.preventDefault()
            extend_save_button.click()

        }

    }

})


// =================================
// UI THEME CUSTOMIZATION
// =================================

let theme_container = document.querySelector(".theme-options")
let custom_theme_container = document.getElementById("custom-theme-options")
let open_themes_button = document.getElementById("open-themes-button")

let available_themes = [
    "green",
    "rose",
    "blue",
    "yellow",
    "orange",
    "purple",
    "pink"
]

// Custom theme JSON keys -> CSS variables
let THEME_VARIABLES = {
    primary: "--primary-color",
    primary_hover: "--primary-hover",
    primary_active: "--primary-active",
    text: "--text-color",
    secondary_text: "--secondary-text",
    border: "--border-color",
    background: "--app-background",
    surface: "--surface-color",
    secondary_background: "--secondary-background",
    secondary_hover: "--secondary-hover",
    secondary_active: "--secondary-active"
}

let HEX_COLOR = /^#[0-9a-fA-F]{6}$/

let custom_themes = {}

let saved_theme = null

try {
    saved_theme = localStorage.getItem("bloombreak-theme")
} catch (error) {
    saved_theme = null
}


let clear_custom_variables = function() {

    let root_style = document.documentElement.style

    Object.values(THEME_VARIABLES).forEach(function(variable) {
        root_style.removeProperty(variable)
    })

    root_style.removeProperty("--theme-gradient")

}


let theme_gradient = function(colors) {

    let start = colors.gradient_start || colors.primary
    let end = colors.gradient_end || colors.primary_active || colors.primary

    if (!HEX_COLOR.test(start || "") || !HEX_COLOR.test(end || "")) {
        return null
    }

    return "linear-gradient(135deg, " + start + ", " + end + ")"

}


let apply_theme = function(theme) {

    let is_custom = typeof theme === "string" &&
        theme.startsWith("custom:") &&
        Object.hasOwn(custom_themes, theme.slice(7))

    if (!available_themes.includes(theme) && !is_custom) {
        return false
    }

    clear_custom_variables()

    if (is_custom) {

        let colors = custom_themes[theme.slice(7)].colors
        let root_style = document.documentElement.style

        document.documentElement.dataset.theme = "green"

        Object.keys(THEME_VARIABLES).forEach(function(key) {
            if (HEX_COLOR.test(colors[key] || "")) {
                root_style.setProperty(THEME_VARIABLES[key], colors[key])
            }
        })

        let gradient = theme_gradient(colors)

        if (gradient) {
            root_style.setProperty("--theme-gradient", gradient)
        }

    } else {

        document.documentElement.dataset.theme = theme

    }

    document.querySelectorAll(".theme-option").forEach(function(option) {

        let is_selected = option.dataset.theme === theme

        option.setAttribute("aria-pressed", is_selected)

    })

    return true

}


let select_theme = function(theme) {

    if (apply_theme(theme)) {

        saved_theme = theme

        try {
            localStorage.setItem("bloombreak-theme", theme)
        } catch (error) {
            console.error("Could not save theme:", error)
        }

    }

}


// Restore previously selected built-in theme right away.
// Custom themes are restored once they are loaded.
if (!apply_theme(saved_theme)) {
    apply_theme("green")
}


// Theme selection behavior (built-in and custom)
let handle_theme_click = function(event) {

    let option = event.target.closest(".theme-option")

    if (option) {
        select_theme(option.dataset.theme)
    }

}

theme_container.addEventListener("click", handle_theme_click)
custom_theme_container.addEventListener("click", handle_theme_click)


let render_custom_themes = function() {

    custom_theme_container.replaceChildren()

    Object.keys(custom_themes).forEach(function(id) {

        let theme = custom_themes[id]

        let button = document.createElement("button")
        button.type = "button"
        button.className = "theme-option"
        button.dataset.theme = "custom:" + id
        button.setAttribute("aria-pressed", saved_theme === "custom:" + id)

        let preview = document.createElement("span")
        preview.className = "theme-preview"
        preview.style.background = theme_gradient(theme.colors) || theme.colors.primary || "#cccccc"

        let name = document.createElement("span")
        name.className = "theme-name"
        name.textContent = theme.name

        button.appendChild(preview)
        button.appendChild(name)

        custom_theme_container.appendChild(button)

    })

    custom_theme_container.hidden = Object.keys(custom_themes).length === 0

}


let load_custom_themes = async function() {

    if (!window.bloomAPI || typeof window.bloomAPI.getCustomThemes !== "function") {
        return
    }

    try {

        let themes = await window.bloomAPI.getCustomThemes()

        custom_themes = {}

        if (Array.isArray(themes)) {
            themes.forEach(function(theme) {
                if (
                    theme &&
                    typeof theme.id === "string" &&
                    typeof theme.name === "string" &&
                    theme.colors && typeof theme.colors === "object"
                ) {
                    custom_themes[theme.id] = theme
                }
            })
        }

        render_custom_themes()

        if (typeof saved_theme === "string" && saved_theme.startsWith("custom:")) {
            if (!apply_theme(saved_theme)) {
                apply_theme("green")
            }
        }

    } catch (error) {
        console.error("Could not load custom themes:", error)
    }

}


open_themes_button.addEventListener("click", function() {

    window.bloomAPI.openThemesFolder()
        .catch(function(error) {
            console.error("Could not open themes folder:", error)
        })

})


// =================================
// WINDOWS STARTUP PREFERENCE
// =================================

let startup_toggle = document.getElementById("startup-toggle");


// Load current startup preference
async function load_startup_setting() {

    try {

        let startup_settings = await window.bloomAPI.getStartup();

        startup_toggle.checked = startup_settings.enabled;
        startup_toggle.disabled = !startup_settings.available;

    } catch (error) {

        console.error("Could not load startup settings:", error);

        startup_toggle.disabled = true;

    }

}


// Save startup preference when changed
startup_toggle.addEventListener("change", async function() {

    let previous_state = !startup_toggle.checked;

    try {

        let success = await window.bloomAPI.setStartup(
            startup_toggle.checked
        );

        if (success !== true) {
            throw new Error("Could not update Windows startup preference.");
        }

    } catch (error) {

        console.error("Could not update startup settings:", error);

        startup_toggle.checked = previous_state;

        alert("Could not update Windows startup settings.");

    }

});

load_startup_setting();


// =================================
// APP VERSION
// =================================

if (window.bloomAPI && typeof window.bloomAPI.getAppInfo === "function") {

    window.bloomAPI.getAppInfo()
        .then(function(info) {

            if (info && typeof info.version === "string") {
                document.getElementById("app-version").textContent =
                    "Version " + info.version
            }

        })
        .catch(function() {})

}


// =================================
// NOTIFICATION NAVIGATION
// =================================

if (
    window.bloomAPI &&
    typeof window.bloomAPI.onNavigateToPhase === "function"
) {

    window.bloomAPI.onNavigateToPhase(function(phase) {

        // Work timer finished: open Water screen
        if (phase === "water") {

            // Ignore outdated notifications
            if (
                current_phase !== "work" ||
                can_water !== true ||
                seconds_left > 0
            ) {
                return;
            }

            settings_open = false;
            was_paused_before_settings = false;

            show_screen(water_screen);

        }

        // Break timer finished: open Approval screen
        else if (phase === "approval") {

            // Ignore outdated notifications
            if (
                current_phase !== "break" ||
                seconds_left > 0
            ) {
                return;
            }

            settings_open = false;
            was_paused_before_settings = false;

            show_screen(approval_screen);

        }

    });

}


// =================================
// STARTUP
// =================================

load_settings()
update_idle_countdowns()
sound_toggle.checked = sound_enabled
plant_type.value = garden.get_plant()

// Restore an interrupted session before the welcome screen
// would clear it
if (restore_session() !== true) {
    show_screen(welcome_screen)
}

load_custom_themes()
