# Inventory Manager Frontend

React frontend application for managing inventory items, tasks, and chatting with a bot.

## Features

- **Chat Page**: Interactive chatbot interface on the homepage
- **Tasks Page**: Create and manage tasks with name, description, and requirements
- **Inventory Page**: Upload images and manage inventory items with name, description, and photos

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the frontend directory (optional):
```
REACT_APP_API_URL=http://localhost:8000
```

3. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

## Project Structure

```
src/
├── components/
│   ├── Navigation.js       # Top navigation bar with tabs
│   └── Navigation.css
├── pages/
│   ├── ChatPage.js         # Chatbot interface
│   ├── ChatPage.css
│   ├── TasksPage.js        # Task management
│   ├── TasksPage.css
│   ├── InventoryPage.js    # Inventory with image upload
│   └── InventoryPage.css
├── App.js                  # Main app component
├── App.css
├── index.js               # Entry point
└── index.css              # Global styles
```
