
// =================================
// BLOOMBREAK STATISTICS SCREEN
// =================================

// Daily / weekly focus chart, summary cards and the
// collection of fully grown plants.

(function() {

    let SVG_NS = "http://www.w3.org/2000/svg"

    let DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    let MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    let current_range = "days"


    // =================================
    // FORMATTING
    // =================================

    let format_duration = function(ms) {

        let total_minutes = Math.floor(ms / 60000)
        let hours = Math.floor(total_minutes / 60)
        let minutes = total_minutes % 60

        if (hours === 0) {
            return minutes + "m"
        }

        return hours + "h " + String(minutes).padStart(2, "0") + "m"

    }

    let format_date = function(date) {
        return date.getDate() + " " + MONTH_NAMES[date.getMonth()]
    }


    // =================================
    // SVG HELPERS
    // =================================

    let svg_element = function(name, attributes, text) {

        let element = document.createElementNS(SVG_NS, name)

        Object.keys(attributes).forEach(function(key) {
            element.setAttribute(key, attributes[key])
        })

        if (text !== undefined) {
            element.textContent = text
        }

        return element

    }


    // Pick a friendly axis maximum in minutes
    let nice_max_minutes = function(max_minutes) {

        let steps = [30, 60, 120, 180, 240, 360, 480, 600, 720, 960, 1200, 1800, 2400, 3000, 3600]

        for (let i = 0; i < steps.length; i++) {
            if (max_minutes <= steps[i]) {
                return steps[i]
            }
        }

        return Math.ceil(max_minutes / 600) * 600

    }


    let minutes_label = function(minutes) {

        if (minutes < 60) {
            return minutes + "m"
        }

        return (minutes / 60) + "h"

    }


    // =================================
    // CHART
    // =================================

    let draw_chart = function(svg, series, label_for) {

        while (svg.firstChild) {
            svg.removeChild(svg.firstChild)
        }

        let width = 344
        let height = 160
        let left = 30
        let right = 4
        let top = 10
        let bottom = 22

        let chart_width = width - left - right
        let chart_height = height - top - bottom

        svg.setAttribute("viewBox", "0 0 " + width + " " + height)

        let max_minutes = Math.max.apply(null, series.map(function(item) {
            return item.ms / 60000
        }))

        let axis_max = nice_max_minutes(Math.max(max_minutes, 1))


        // Grid lines
        for (let i = 0; i <= 2; i++) {

            let value = axis_max * i / 2
            let y = top + chart_height - chart_height * i / 2

            svg.appendChild(svg_element("line", {
                x1: left,
                x2: width - right,
                y1: y,
                y2: y,
                class: "chart-grid"
            }))

            svg.appendChild(svg_element("text", {
                x: left - 6,
                y: y + 3,
                class: "chart-axis",
                "text-anchor": "end"
            }, minutes_label(Math.round(value))))

        }


        // Bars
        let slot = chart_width / series.length
        let bar_width = Math.min(26, slot * 0.62)

        series.forEach(function(item, index) {

            let minutes = item.ms / 60000
            let bar_height = Math.max(minutes > 0 ? 2 : 0, chart_height * minutes / axis_max)

            let x = left + slot * index + (slot - bar_width) / 2
            let y = top + chart_height - bar_height

            let bar = svg_element("rect", {
                x: x.toFixed(1),
                y: y.toFixed(1),
                width: bar_width.toFixed(1),
                height: bar_height.toFixed(1),
                rx: 3,
                class: item.is_current ? "chart-bar chart-bar-current" : "chart-bar"
            })

            bar.appendChild(svg_element(
                "title",
                {},
                label_for(item, true) + ": " + format_duration(item.ms)
            ))

            svg.appendChild(bar)

            svg.appendChild(svg_element("text", {
                x: (x + bar_width / 2).toFixed(1),
                y: height - 6,
                class: item.is_current ? "chart-axis chart-axis-current" : "chart-axis",
                "text-anchor": "middle"
            }, label_for(item, false)))

        })

    }


    // =================================
    // RENDER SCREEN
    // =================================

    let render_stats = function() {

        let garden = window.BloomGarden
        let summary = garden.get_summary()

        document.getElementById("stat-today").textContent = format_duration(summary.today_ms)
        document.getElementById("stat-week").textContent = format_duration(summary.week_ms)
        document.getElementById("stat-streak").textContent =
            summary.streak + (summary.streak === 1 ? " day" : " days")
        document.getElementById("stat-total").textContent = format_duration(summary.total_ms)

        let svg = document.getElementById("stats-chart")

        if (current_range === "days") {

            draw_chart(svg, garden.get_daily_series(7), function(item, long) {
                return long
                    ? DAY_NAMES[item.date.getDay()] + " " + format_date(item.date)
                    : DAY_NAMES[item.date.getDay()]
            })

        } else {

            draw_chart(svg, garden.get_weekly_series(6), function(item, long) {
                return long
                    ? "Week of " + format_date(item.date)
                    : format_date(item.date)
            })

        }

        document.querySelectorAll(".stats-range").forEach(function(button) {
            button.setAttribute("aria-pressed", button.dataset.range === current_range)
        })


        // Completed plants
        let collection = document.getElementById("stats-collection")
        let completed = garden.get_completed()

        collection.replaceChildren()

        if (completed.length === 0) {

            let empty = document.createElement("p")
            empty.className = "stats-empty"
            empty.textContent = "Fully grown plants will appear here. Keep focusing!"
            collection.appendChild(empty)

        } else {

            completed.slice(-24).reverse().forEach(function(item) {

                let icon = document.createElement("canvas")
                icon.width = 40
                icon.height = 40
                icon.className = "stats-plant"
                icon.title =
                    garden.PLANTS[item.plant].name +
                    " · grown " +
                    format_date(new Date(item.completed_at))

                garden.draw_plant_icon(icon, item.plant)

                collection.appendChild(icon)

            })

        }

        document.getElementById("stats-collection-count").textContent =
            "(" + summary.completed + ")"

    }


    document.querySelectorAll(".stats-range").forEach(function(button) {

        button.addEventListener("click", function() {
            current_range = button.dataset.range
            render_stats()
        })

    })


    window.BloomStats = {
        render: render_stats,
        format_duration: format_duration
    }

})()
