# Project Rules

## Development Server Configuration
- When the user asks to start, run, or open the development server, always use port **5173**.
- Execute the dev server using the following command:
  ```bash
  npx next dev -p 5173
  ```
- Do not run on port 3000, as port 3000 is reserved for another running project (`ai-content-platform`).
