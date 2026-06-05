import QtQuick

Item {
    id: root

    // --- Properties ---

    // Current display state key: "idle", "greeting", "thinking", etc.
    property string stateName: "idle"

    // Base path for role images (qrc: or file://)
    property string imagePath: "qrc:/native-desktop/assets/roles/default/images/"

    // --- Signals ---
    signal dragStarted()
    signal dragFinished()
    signal clicked(string zone)
    signal doubleClicked()

    // --- State → image mapping ---
    function imageForState(state) {
        return imagePath + state + ".png"
    }

    // --- Main pet image with fade transition ---
    Image {
        id: petImage
        anchors.fill: parent
        fillMode: Image.PreserveAspectFit
        source: root.imageForState(root.stateName)
        asynchronous: true
        cache: true
        smooth: true

        // Cross-fade on state change
        Behavior on source {
            SequentialAnimation {
                PropertyAnimation {
                    target: petImage
                    property: "opacity"
                    to: 0.3
                    duration: 120
                }
                PropertyAction { }  // source changes here
                PropertyAnimation {
                    target: petImage
                    property: "opacity"
                    to: 1.0
                    duration: 200
                }
            }
        }

        // --- Drag handling ---
        MouseArea {
            id: dragArea
            anchors.fill: parent
            acceptedButtons: Qt.LeftButton
            hoverEnabled: true

            property point lastPos: Qt.point(0, 0)
            property bool dragging: false
            property real dragThreshold: 5

            onPressed: mouse => {
                lastPos = Qt.point(mouse.x, mouse.y)
                dragging = false
            }

            onPositionChanged: mouse => {
                if (!dragging) {
                    var dx = mouse.x - lastPos.x
                    var dy = mouse.y - lastPos.y
                    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
                        dragging = true
                        root.dragStarted()
                    }
                }
                if (dragging) {
                    var globalPos = dragArea.mapToGlobal(mouse.x, mouse.y)
                    root.parent.x = globalPos.x - lastPos.x
                    root.parent.y = globalPos.y - lastPos.y
                }
            }

            onReleased: mouse => {
                if (dragging) {
                    root.dragFinished()
                } else {
                    // Short press = click with zone detection
                    var zone = (mouse.y / root.height < 0.3) ? "head"
                             : (mouse.y / root.height < 0.7) ? "face"
                             : "body"
                    root.clicked(zone)
                }
                dragging = false
            }

            onDoubleClicked: mouse => {
                root.doubleClicked()
            }
        }
    }

    // --- Debug badge ---
    StateBadge {
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 8
        stateName: root.stateName
    }
}
