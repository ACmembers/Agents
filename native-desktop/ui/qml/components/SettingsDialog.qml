import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

Dialog {
    id: root
    title: "DeskPet 设置"
    modal: true
    standardButtons: Dialog.Ok | Dialog.Cancel
    width: 480
    height: 520

    // Bound properties (filled by Rust AppModel)
    property string apiKey: ""
    property string activeProvider: "deepseek"
    property string model: "deepseek-chat"
    property real temperature: 0.7
    property string language: "zh"
    property string ttsVoice: "zh-CN-XiaoxiaoNeural"
    property real ttsSpeed: 1.0
    property int ttsVolume: 80
    property bool searchEnabled: true
    property string activeRole: ""

    signal settingsChanged(var settings)

    onAccepted: {
        root.settingsChanged({
            apiKey: apiKey,
            activeProvider: activeProvider,
            model: model,
            temperature: temperature,
            language: language,
            ttsVoice: ttsVoice,
            ttsSpeed: ttsSpeed,
            ttsVolume: ttsVolume,
            searchEnabled: searchEnabled,
            activeRole: activeRole
        })
    }

    ScrollView {
        anchors.fill: parent
        clip: true

        ColumnLayout {
            width: parent.width - 20
            spacing: 12

            // --- API 设置 ---
            GroupBox {
                title: "API 设置"
                Layout.fillWidth: true
                ColumnLayout {
                    spacing: 6

                    RowLayout {
                        Label { text: "提供商:"; Layout.preferredWidth: 80 }
                        ComboBox {
                            id: providerCombo
                            model: ["deepseek", "openai", "qwen", "moonshot", "zhipu"]
                            currentIndex: model.indexOf(root.activeProvider)
                            onCurrentTextChanged: root.activeProvider = currentText
                        }
                    }

                    RowLayout {
                        Label { text: "API Key:"; Layout.preferredWidth: 80 }
                        TextField {
                            id: apiKeyField
                            Layout.fillWidth: true
                            text: root.apiKey
                            echoMode: TextInput.Password
                            onTextChanged: root.apiKey = text
                        }
                    }

                    RowLayout {
                        Label { text: "模型:"; Layout.preferredWidth: 80 }
                        ComboBox {
                            id: modelCombo
                            editable: true
                            model: {
                                switch (root.activeProvider) {
                                    case "deepseek": return ["deepseek-chat", "deepseek-reasoner"]
                                    case "openai":   return ["gpt-4o-mini", "gpt-4o"]
                                    case "qwen":     return ["qwen-plus", "qwen-max"]
                                    case "moonshot": return ["moonshot-v1-8k", "moonshot-v1-32k"]
                                    case "zhipu":    return ["glm-4-flash", "glm-4-plus"]
                                }
                                return []
                            }
                            currentIndex: model.indexOf(root.model) >= 0 ? model.indexOf(root.model) : 0
                            onCurrentTextChanged: root.model = currentText
                        }
                    }

                    RowLayout {
                        Label { text: "Temperature:"; Layout.preferredWidth: 80 }
                        Slider {
                            id: tempSlider
                            from: 0.0; to: 2.0; stepSize: 0.1
                            value: root.temperature
                            Layout.fillWidth: true
                            onValueChanged: root.temperature = value
                        }
                        Label { text: root.temperature.toFixed(1) }
                    }
                }
            }

            // --- 语音设置 ---
            GroupBox {
                title: "语音设置"
                Layout.fillWidth: true
                ColumnLayout {
                    spacing: 6

                    RowLayout {
                        Label { text: "语言:"; Layout.preferredWidth: 80 }
                        ComboBox {
                            id: langCombo
                            model: [
                                { text: "中文", value: "zh" },
                                { text: "日本語", value: "ja" }
                            ]
                            textRole: "text"
                            currentIndex: root.language === "ja" ? 1 : 0
                            onCurrentIndexChanged: {
                                root.language = model[currentIndex].value
                                // Auto-select a matching voice
                                if (root.language === "ja")
                                    root.ttsVoice = "ja-JP-NanamiNeural"
                                else
                                    root.ttsVoice = "zh-CN-XiaoxiaoNeural"
                            }
                        }
                    }

                    RowLayout {
                        Label { text: "语音:"; Layout.preferredWidth: 80 }
                        ComboBox {
                            id: voiceCombo
                            editable: true
                            model: root.language === "ja"
                                ? ["ja-JP-NanamiNeural", "ja-JP-KeitaNeural", "ja-JP-AoiNeural", "ja-JP-DaichiNeural"]
                                : ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "zh-CN-XiaoyiNeural", "zh-CN-YunyangNeural"]
                            currentIndex: model.indexOf(root.ttsVoice) >= 0 ? model.indexOf(root.ttsVoice) : 0
                            onCurrentTextChanged: root.ttsVoice = currentText
                        }
                    }

                    RowLayout {
                        Label { text: "语速:"; Layout.preferredWidth: 80 }
                        Slider {
                            from: 0.5; to: 2.0; stepSize: 0.1
                            value: root.ttsSpeed
                            Layout.fillWidth: true
                            onValueChanged: root.ttsSpeed = value
                        }
                        Label { text: root.ttsSpeed.toFixed(1) + "x" }
                    }

                    RowLayout {
                        Label { text: "音量:"; Layout.preferredWidth: 80 }
                        Slider {
                            from: 0; to: 100; stepSize: 5
                            value: root.ttsVolume
                            Layout.fillWidth: true
                            onValueChanged: root.ttsVolume = value
                        }
                        Label { text: root.ttsVolume + "%" }
                    }
                }
            }

            // --- 搜索 ---
            GroupBox {
                title: "联网搜索"
                Layout.fillWidth: true
                RowLayout {
                    Label { text: "启用搜索:"; Layout.preferredWidth: 80 }
                    Switch {
                        checked: root.searchEnabled
                        onCheckedChanged: root.searchEnabled = checked
                    }
                }
            }

            // --- 角色 ---
            GroupBox {
                title: "角色"
                Layout.fillWidth: true
                RowLayout {
                    Label { text: "当前角色:"; Layout.preferredWidth: 80 }
                    Label { text: root.activeRole || "默认"; font.bold: true }
                }
            }
        }
    }
}
