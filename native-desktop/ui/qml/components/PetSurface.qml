import QtQuick

Item {
    id: root

    // --- Properties ---

    property string stateName: "idle"
    property string imagePath: "qrc:/native-desktop/assets/roles/default/images/"
    property string chatText: ""     // current LLM response (incremental in stream)
    property bool showInput: false

    // --- Signals ---
    signal dragStarted()
    signal dragFinished()
    signal clicked(string zone)
    signal doubleClicked()
    signal messageSent(string text)

    // --- State → image mapping ---
    function imageForState(state) { return imagePath + state + ".png" }

    // --- Main pet image with fade transition ---
    Image {
        id: petImage
        anchors.fill: parent
        fillMode: Image.PreserveAspectFit
        source: root.imageForState(root.stateName)
        asynchronous: true; cache: true; smooth: true

        Behavior on source {
            SequentialAnimation {
                PropertyAnimation { target: petImage; property: "opacity"; to: 0.3; duration: 120 }
                PropertyAction { }
                PropertyAnimation { target: petImage; property: "opacity"; to: 1.0; duration: 200 }
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

            onPressed: mouse => { lastPos = Qt.point(mouse.x, mouse.y); dragging = false }
            onPositionChanged: mouse => {
                if (!dragging) {
                    var dx = mouse.x - lastPos.x; var dy = mouse.y - lastPos.y
                    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
                        dragging = true; root.dragStarted()
                    }
                }
                if (dragging) {
                    var gp = dragArea.mapToGlobal(mouse.x, mouse.y)
                    root.parent.x = gp.x - lastPos.x; root.parent.y = gp.y - lastPos.y
                }
            }
            onReleased: mouse => {
                if (dragging) root.dragFinished()
                else {
                    var zone = (mouse.y / root.height < 0.3) ? "head"
                             : (mouse.y / root.height < 0.7) ? "face" : "body"
                    root.clicked(zone)
                }
                dragging = false
            }
            onDoubleClicked: mouse => { root.showInput = true }
        }
    }

    // --- Chat bubble (above the pet) ---
    ChatBubble {
        id: chatBubble
        anchors {
            bottom: parent.bottom
            horizontalCenter: parent.horizontalCenter
            bottomMargin: parent.height + 4
        }
        z: 10
        text: root.chatText
    }

    // --- Input overlay ---
    ChatInput {
        id: chatInput
        showing: root.showInput
        z: 20
        onSendMessage: text => { root.messageSent(text); root.showInput = false }
        onDismissed: root.showInput = false
    }

    // --- Debug badge ---
    StateBadge {
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 8
        stateName: root.stateName
    }
}
