import QtQuick

Rectangle {
    id: root

    property string stateName: "idle"

    radius: 8
    color: "#66000000"
    border.color: "#33ffffff"

    implicitWidth: label.implicitWidth + 16
    implicitHeight: label.implicitHeight + 10

    Text {
        id: label
        anchors.centerIn: parent
        color: "white"
        text: root.stateName
        font.pixelSize: 12
    }
}
