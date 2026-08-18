# Google Chat Org Chart Extension 🌳

A Chrome Extension (Manifest V3) that seamlessly injects your company's organizational chart directly into the Google Chat web interface (`chat.google.com`). 

✨ **Vibe Coded** — This project was entirely built via AI pair programming using Google's Antigravity agentic coding assistant!

## Features

- **Native Look & Feel:** UI built meticulously following Google's **Material Design 3** guidelines, matching Google Chat's own sidebar menus, hover states, and active pill shapes.
- **Dynamic Injection:** Uses `MutationObserver` to reliably inject the menu button into Google Chat's SPA (Single Page Application) without reloading or breaking native features.
- **Real-Time Search:** Instantly filter your organization by Name, Role, or Team.
- **Auto Avatars:** If an employee doesn't have a photo, it automatically generates a Google-style fallback avatar using their initials and a consistent Material color.
- **No External Dependencies:** Lightweight vanilla JavaScript and CSS.

## Installation

Since this is an unpacked extension, you can install it in a few simple steps:

1. **Clone the repository** or download the ZIP file:
   ```bash
   git clone https://github.com/Pedroglp/GoogleChat-OrgChart.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `GoogleChat-OrgChart` directory you just cloned.
6. Open or refresh [Google Chat](https://chat.google.com). You should now see the **Org Chart** option in the left sidebar!

## Configuration

The organizational data is statically loaded from `org-data.json`. To use this in your own company, simply edit `org-data.json` to match your hierarchy. 

**JSON Structure:**
```json
[
  {
    "id": "1",
    "name": "Employee Name",
    "role": "Job Title",
    "team": "Department",
    "managerId": null,
    "avatarUrl": "https://..."
  }
]
```
*(Note: Ensure `managerId` correctly points to the `id` of the direct supervisor. Leave it `null` for the CEO/Founders).*

## Contributing

Feel free to fork this project, submit pull requests, or use it as a base for your own internal company tools!
