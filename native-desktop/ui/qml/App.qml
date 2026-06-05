import QtQuick
import QtQuick.Window

Window {
    id: root
    width: 320
    height: 400
    visible: true
    color: "transparent"
    flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool
    property string chatText: ""

    // --- Edge snapping ---
    readonly property int snapMargin: 30
    property bool snapped: false
    property int snapDir: 0
    property int savedX: 0
    property int savedY: 0

    Timer {
        id: snapCheckTimer
        interval: 400; repeat: true; running: true
        onTriggered: { if (root.snapped) unsnap() }
    }
    function snapToEdge() {
        if (snapped) return
        var sw = Screen.desktopAvailableWidth; var sh = Screen.desktopAvailableHeight
        if (x < snapMargin && x > -width) { savedX=x; savedY=y; x=-width+4; snapDir=1; snapped=true }
        else if (x+width>sw-snapMargin && x+width<sw+snapMargin) { savedX=x; savedY=y; x=sw-4; snapDir=2; snapped=true }
        else if (y<snapMargin && y>-height) { savedX=x; savedY=y; y=-height+4; snapDir=3; snapped=true }
    }
    function unsnap() { if(!snapped) return; x=savedX; y=savedY; snapDir=0; snapped=false }

    // Pet image
    Image {
        id: petImage
        anchors.fill: parent
        fillMode: Image.PreserveAspectFit
        source: "file:///C:/deskpet/native-desktop/assets/roles/sakura/images/" + stateName + ".png"
        asynchronous: true; cache: true; smooth: true

        property string stateName: "idle"

        Behavior on source {
            SequentialAnimation {
                PropertyAnimation { target: petImage; property: "opacity"; to: 0.3; duration: 120 }
                PropertyAction { }
                PropertyAnimation { target: petImage; property: "opacity"; to: 1.0; duration: 200 }
            }
        }

        MouseArea {
            anchors.fill: parent
            property point lp: Qt.point(0,0)
            property bool d: false
            onPressed: m => { lp = Qt.point(m.x, m.y); d = false }
            onPositionChanged: m => {
                if(!d && (Math.abs(m.x-lp.x)>5 || Math.abs(m.y-lp.y)>5)) { d=true; root.unsnap() }
                if(d) { var g = mapToGlobal(m.x, m.y); root.x=g.x-lp.x; root.y=g.y-lp.y }
            }
            onReleased: m => { if(d) root.snapToEdge(); else { petImage.stateName = states[Math.floor(Math.random()*states.length)] }; d=false }
        }
    }

    // State badge
    Rectangle {
        anchors.right: parent.right; anchors.top: parent.top; anchors.margins: 8
        radius: 8; color: "#66000000"; border.color: "#33ffffff"
        width: label.implicitWidth + 16; height: label.implicitHeight + 10
        Text {
            id: label
            anchors.centerIn: parent
            color: "white"; font.pixelSize: 12
            text: {
                switch(petImage.stateName) {
                    case "idle": return "待机"; case "greeting": return "问候"
                    case "thinking": return "思考"; case "happy": return "开心"
                    case "sad": return "难过"; case "surprised": return "惊讶"
                    case "listening": return "倾听"; case "sleeping": return "睡觉"
                    default: return petImage.stateName
                }
            }
        }
    }

    property var states: ["idle","greeting","thinking","happy","sad","surprised","listening","sleeping"]

    Timer {
        id: bridgeTimer; interval: 200; repeat: true; running: true
        onTriggered: {
            var xhr = new XMLHttpRequest()
            xhr.open("GET", "file:///C:/tmp/deskpet-bridge/state.json", false)
            try { xhr.send() } catch(e) { return }
            try {
                var s = JSON.parse(xhr.responseText)
                if(s.state) petImage.stateName = s.state
                if(s.text !== undefined) root.chatText = s.text
            } catch(e2) {}
        }
    }

    Component.onCompleted: {
        x = (Screen.width - width) / 2
        y = (Screen.height - height) / 2
    }
    Rectangle {
        anchors { bottom: parent.bottom; horizontalCenter: parent.horizontalCenter; bottomMargin: parent.height+6 }
        visible: root.chatText.length > 0
        radius: 12; color: "#e8f4fd"; border.color: "#88c8e8"
        width: Math.min(btext.implicitWidth+24, parent.width-20)
        height: btext.implicitHeight+20
        opacity: root.chatText.length>0?0.92:0
        Behavior on opacity { NumberAnimation{duration:200} }
        Text { id: btext; anchors{left:parent.left;right:parent.right;top:parent.top;margins:10}
            text: root.chatText; wrapMode: Text.WordWrap; font.pixelSize: 14; color: "#333" }
    }
    Timer { interval: 10000; running: root.chatText.length>0; repeat: false; onTriggered: root.chatText="" }

}
