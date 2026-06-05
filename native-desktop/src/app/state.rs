#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum DisplayState {
    #[default]
    Idle,
    Greeting,
    Thinking,
    Happy,
    Sad,
    Surprised,
    Listening,
    Sleeping,
}
