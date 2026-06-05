import QtQuick

Item {
    id: root

    // String key for the current pet display state (e.g., "idle").
    property string stateName: "idle"

    Rectangle {
        anchors.fill: parent
        color: "transparent"
        border.color: "#33ffffff"
        radius: 16
    }

    StateBadge {
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 8
        stateName: root.stateName
    }
}
