# AlignHub

AlignHub is a real-time collaborative workspace built as part of the Readynest Week 4 Full Stack Development Internship.

The goal of this project is to provide a single workspace where multiple users can communicate, manage tasks, share notes, and collaborate in real time.

## Features

- User Registration & Login
- JWT Authentication
- Create and Join Workspaces
- Real-Time Chat
- Shared Notes
- Kanban Task Board
- Online User Status
- Activity Tracking
- Role-Based Access
- Notifications
- MongoDB Data Persistence
- Responsive UI

## Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- React Router
- Socket.IO Client

### Backend
- Node.js
- Express.js
- Socket.IO
- JWT
- Bcrypt
- Multer

### Database
- MongoDB Atlas

## Getting Started

Clone the repository

```bash
git clone https://github.com/adilkhan74690-tech/AlignHub.git
```

Install dependencies

```bash
npm install
```

Create a `.env` file inside the server folder.

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Run the project

```bash
npm run dev
```

## Demo Account

You can use the following account to explore the application.

**Email**

```
test@gmail.com
```

**Password**

```
123456
```

## Folder Structure

```
client/
server/
```

Both folders are separated to keep the frontend and backend independent and easier to maintain.

## Future Scope

- Live Cursor Tracking
- Version History
- Export Workspace Data
- Workspace Invitations

## Author

**Mohammad Adil Khan**
