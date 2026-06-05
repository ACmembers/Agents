use crate::app::state::DisplayState;

#[test]
fn default_state_is_idle() {
    assert_eq!(DisplayState::default(), DisplayState::Idle);
}
