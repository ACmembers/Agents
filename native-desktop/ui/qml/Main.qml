import QtQuick
import QtQuick.Window
import "components"

Window {
    width: 320
    height: 400
    visible: true
    color: "transparent"
    flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint

    PetSurface {
        anchors.fill: parent
        stateName: "idle"
    }
}
