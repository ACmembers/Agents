import QtQuick

Rectangle {
    id: root

    // English state key (e.g. "idle")
    property string stateName: "idle"

    // Chinese label lookup
    function chineseLabel(state) {
        switch (state) {
            case "idle":      return "待机"
            case "greeting":  return "问候"
            case "thinking":  return "思考"
            case "happy":     return "开心"
            case "sad":       return "难过"
            case "surprised": return "惊讶"
            case "listening": return "倾听"
            case "sleeping":  return "睡觉"
            default:          return state
        }
    }

    radius: 8
    color: "#66000000"
    border.color: "#33ffffff"

    implicitWidth: label.implicitWidth + 16
    implicitHeight: label.implicitHeight + 10

    Text {
        id: label
        anchors.centerIn: parent
        color: "white"
        text: root.chineseLabel(root.stateName)
        font.pixelSize: 12
    }
}
