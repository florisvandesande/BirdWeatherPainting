# {{NAME}} DeskPet

Native animated macOS desktop companion.

- Click for the configured greeting action.
- Double-click for affection.
- Drag horizontally to walk in the drag direction.
- Drag vertically to pick the character up.
- Move the pointer over the head to pet the character.
- Right-click for actions, pause, reminders, and quit.

Autonomous walks choose a fresh distance between `minDistanceFraction` and `maxDistanceFraction` in `pet.json`, measured against usable screen width. The default is 10–70%. Direction is forced inward only in the outer quarters; through the middle half the pet keeps its current direction.

Requires Apple-silicon macOS 13 or newer. If Gatekeeper warns on first launch, right-click the app and choose **Open**.
