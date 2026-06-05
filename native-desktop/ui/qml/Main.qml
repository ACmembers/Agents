import QtQuick
import QtQuick.Window
import "components"

Window {
    id: root
    width: 320
    height: 400
    visible: true
    color: "transparent"

    // Transparent frameless window, stays on top, no taskbar entry
    flags: Qt.FramelessWindowHint
           | Qt.WindowStaysOnTopHint
           | Qt.Tool

    // --- Edge snapping ---
    readonly property int snapMargin: 30
    property bool snapped: false
    property int snapDir: 0   // 0=none, 1=left, 2=right, 3=top

    // Saved position before snap
    property int savedX: 0
    property int savedY: 0

    // Restore window when mouse comes near the snapped edge
    Timer {
        id: snapCheckTimer
        interval: 400
        repeat: true
        running: true
        onTriggered: {
            if (!root.snapped) return

            // Check if mouse is near the snapped edge
            var mx = petSurface.mapFromGlobal(petSurface.Window.window ? 0 : 0).x
            var edgeThreshold = 8

            var shouldUnsnap = false
            if (snapDir === 1 && root.x > -root.width + edgeThreshold) shouldUnsnap = true
            if (snapDir === 2 && root.x < Screen.desktopAvailableWidth - edgeThreshold) shouldUnsnap = true
            if (snapDir === 3 && root.y > -root.height + edgeThreshold) shouldUnsnap = true

            if (shouldUnsnap) unsnap()
        }
    }

    function snapToEdge() {
        if (snapped) return
        var sw = Screen.desktopAvailableWidth
        var sh = Screen.desktopAvailableHeight

        if (x < snapMargin && x > -width) {
            savedX = x; savedY = y
            x = -width + 4
            snapDir = 1; snapped = true
        } else if (x + width > sw - snapMargin && x + width < sw + snapMargin) {
            savedX = x; savedY = y
            x = sw - 4
            snapDir = 2; snapped = true
        } else if (y < snapMargin && y > -height) {
            savedX = x; savedY = y
            y = -height + 4
            snapDir = 3; snapped = true
        }
    }

    function unsnap() {
        if (!snapped) return
        x = savedX
        y = savedY
        snapDir = 0
        snapped = false
    }

    // --- Pet surface ---
    PetSurface {
        id: petSurface
        anchors.fill: parent
        stateName: "idle"
        imagePath: "qrc:/native-desktop/assets/roles/default/images/"

        onDragStarted: root.unsnap()
        onDragFinished: root.snapToEdge()
        onClicked: zone => console.log("[Main] clicked zone:", zone)
        onDoubleClicked: console.log("[Main] double-clicked")
    }

    Component.onCompleted: {
        x = (Screen.width - width) / 2
        y = (Screen.height - height) / 2
        console.log("[Main] DeskPet window ready at", x, y)
    }
}
