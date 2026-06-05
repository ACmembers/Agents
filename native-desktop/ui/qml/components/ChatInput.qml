import QtQuick
import QtQuick.Controls

Item {
    id: root

    property bool showing: false
    signal sendMessage(string text)
    signal dismissed()

    visible: showing
    anchors.fill: parent

    // Semi-transparent backdrop to catch clicks
    MouseArea {
        anchors.fill: parent
        onClicked: root.dismiss()
    }

    // Input bar at the bottom of the pet
    Rectangle {
        id: inputBar
        anchors {
            left: parent.left
            right: parent.right
            bottom: parent.bottom
            margins: 8
        }
        height: 44
        radius: 22
        color: "#f0f0f0"
        border.color: "#ccc"

        Row {
            anchors {
                fill: parent
                leftMargin: 16
                rightMargin: 8
            }
            spacing: 6

            TextField {
                id: msgField
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width - sendBtn.width - 20
                placeholderText: "说点什么..."
                font.pixelSize: 14
                background: Item {}
                onAccepted: root.send()
            }

            Button {
                id: sendBtn
                anchors.verticalCenter: parent.verticalCenter
                text: "发送"
                font.pixelSize: 13
                flat: true
                onClicked: root.send()
            }
        }
    }

    function send() {
        var msg = msgField.text.trim()
        if (msg.length > 0) {
            root.sendMessage(msg)
            msgField.text = ""
        }
        root.dismiss()
    }

    function show() {
        root.showing = true
        msgField.forceActiveFocus()
    }

    function dismiss() {
        root.showing = false
        root.dismissed()
    }
}
