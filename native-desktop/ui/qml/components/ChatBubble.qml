import QtQuick

Item {
    id: root

    property string text: ""
    property bool visible: text.length > 0

    visible: root.text.length > 0
    width: Math.min(bubbleText.implicitWidth + 24, parent.width - 20)
    height: bubbleText.implicitHeight + 20

    Rectangle {
        id: bubbleBg
        anchors.fill: parent
        radius: 12
        color: "#e8f4fd"
        border.color: "#88c8e8"
        opacity: root.text.length > 0 ? 0.92 : 0

        Behavior on opacity { NumberAnimation { duration: 200 } }

        Text {
            id: bubbleText
            anchors {
                left: parent.left
                right: parent.right
                top: parent.top
                margins: 10
            }
            text: root.text
            wrapMode: Text.WordWrap
            font.pixelSize: 14
            color: "#333"
        }
    }

    // Auto-hide timer — resets when text changes
    Timer {
        id: hideTimer
        interval: 10000
        running: root.text.length > 0
        repeat: false
        onTriggered: root.text = ""
    }
}
