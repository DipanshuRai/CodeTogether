# CodeTogether - Real-Time Collaborative IDE

[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-000?style=for-the-badge&logo=webrtc&logoColor=red)](https://webrtc.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Mediasoup](https://img.shields.io/badge/Mediasoup-blue?style=for-the-badge&logo=mediasoup&logoColor=white)](https://mediasoup.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> **CodeTogether** is a comprehensive, browser-based Integrated Development Environment (IDE) designed for seamless real-time collaboration. It unifies code editing, live code execution, audio/video communication, screen sharing, and interactive whiteboarding into a single, intuitive platform.

**Perfect for**: Pair programming • Technical interviews • Remote team development • Online coding education • System design discussions

[🚀 Live Project](https://code-together-seven.vercel.app/)

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#-core-features)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)
- [Contact](#-contact)

---

## Overview

CodeTogether eliminates friction in remote software collaboration by consolidating multiple tools into a single, unified workspace. Whether you're conducting technical interviews, pair programming with distributed teams, or teaching coding concepts, CodeTogether provides everything you need.

### Use Cases

| Scenario | Benefit |
| :--- | :--- |
| **Technical Interviews** | Real-time code evaluation, screen sharing, and communication in one platform |
| **Pair Programming** | Multi-cursor editing, synchronized scrolling, and integrated audio/video |
| **Team Collaboration** | Create persistent or ephemeral rooms with unique IDs for instant collaboration |
| **Online Education** | Whiteboard for concepts, live code execution for immediate feedback |
| **System Design** | Interactive canvas for architecture diagrams, code examples, and discussions |

---

## 📸 Screenshots

### Homepage - Landing Page
![Homepage](frontend/public/screenshots/homePage.png)

### Code Editor - With Input/Output Panel
![EditorWithIO](frontend/public/screenshots/editorWithIO.png)

### Code Editor - With Canvas/Whiteboard
![EditorWithCanvas](frontend/public/screenshots/editorWithCanvas.png)

### Interactive Whiteboard
![Canvas](frontend/public/screenshots/canvas.png)

---

## 🎯 Core Features

### 👨‍💻 Real-Time Collaborative Code Editor
- **Monaco Editor Integration**: Same powerful editor used in VS Code
- **Multi-Language Support**: C, C++, Java, JavaScript, Python, TypeScript, C#, PHP, MySQL
- **Synchronized Editing**: Real-time cursor positions, selections, and content synchronization via Y.js CRDT
- **Syntax Highlighting**: Language-aware code highlighting and formatting
- **Customizable Experience**: Font size, minimap toggle, word wrap, and more
- **Conflict-Free Editing**: Leverages Conflict-Free Replicated Data Types (CRDT) for robust multi-user editing

### ▶️ Integrated Code Execution Engine
- **Multi-Language Runtime**: Execute code in 9+ programming languages without local setup
- **Real-Time Output**: View stdout, stderr, and execution results instantly
- **Standard Input Support**: Provide stdin for interactive programs
- **Size-Limited Execution**: 100KB code limit, 10KB stdin limit for security
- **Piston API Backend**: Secure, containerized code execution via the Piston API

### 📹 High-Quality Audio & Video Conferencing
- **WebRTC + Mediasoup**: Enterprise-grade SFU (Selective Forwarding Unit) architecture
- **Scalable Connections**: Support for multiple simultaneous video streams without bandwidth saturation
- **Toggle Controls**: Enable/disable camera and microphone on the fly
- **Low Latency**: Sub-100ms latency for natural communication
- **Adaptive Quality**: Automatic bitrate adjustment based on network conditions

### 🖥️ Screen Sharing & Presentation Mode
- **Full Screen Capture**: Share your entire display or specific windows
- **Adaptive Bitrate Encoding**: Up to 900kbps for smooth screen sharing
- **Presenter Mode**: Pinned main video with thumbnail grid for focus
- **Easy Control**: Single-click toggle to start/stop sharing

### 🎨 Interactive Digital Whiteboard
- **Drawing Tools**: Pen, eraser, color palette, adjustable brush size
- **Collaboration**: All participants can draw and edit simultaneously
- **Undo/Redo**: Full history navigation for sketches
- **Export Functionality**: Download whiteboard as PNG for documentation
- **Persistent Canvas**: Keep the whiteboard visible alongside code editor

### 🔐 Secure Authentication & Authorization
- **JWT-Based Sessions**: Secure, stateless token authentication
- **Dual Auth Providers**: Local (email/password) and Google OAuth 2.0
- **Refresh Token Rotation**: Automatic token refresh with httpOnly cookies
- **Bcrypt Password Hashing**: Industry-standard password security
- **Session Management**: Automatic cleanup on logout and token expiration

---

## 🚀 Quick Start

### For Users
1. Visit [CodeTogether](https://code-together-seven.vercel.app/)
2. Sign up with email or Google account
3. Choose: **Create Room** (new session) or **Join Room** (existing session) or **Practice Solo**
4. Start collaborating!

### For Developers
```bash
# Clone the repository
git clone https://github.com/DipanshuRai/CodeTogether.git
cd CodeTogether

# Backend Setup
cd backend
npm install
npm run dev

# Frontend Setup (new terminal)
cd frontend
npm install
npm run dev
```

---

## 🏗️ Architecture

### System Design Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React/Browser)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Monaco Editor ←→ Y.js (CRDT) ←→ Liveblocks WebSocket   │   │
│  │              Mediasoup Client ←→ Socket.IO               │   │
│  │            getUserMedia() / getDisplayMedia()            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                        ↓ WebSocket/WebRTC
┌─────────────────────────────────────────────────────────────────┐
│                SIGNALING SERVER (Node.js/Express)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │    Socket.IO Server → Room Manager → State Management    │   │
│  │               Mediasoup Router → WebRTC SFU              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        ↓ REST API         ↓ CRDT Sync         ↓ Code Execution
    ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
    │  MongoDB    │   │  Liveblocks  │   │  Piston API      │
    │  (Auth/User)│   │  (Y.js Sync) │   │  (Code Sandbox)  │
    └─────────────┘   └──────────────┘   └──────────────────┘
```

### Key Design Patterns

| Component | Pattern | Purpose |
| :--- | :--- | :--- |
| **Text Sync** | CRDT (Y.js + Liveblocks) | Conflict-free collaborative editing without operational transforms |
| **Media Delivery** | SFU (Mediasoup) | Scalable WebRTC for multiple video streams with single uplink |
| **Real-Time Events** | Socket.IO + Event Emitters | Loosely coupled room and media management |
| **Authentication** | JWT + Refresh Tokens | Stateless, secure session management with auto-refresh |
| **Code Execution** | Sandboxed API (Piston) | Secure execution of untrusted user code |

---

## 🛠️ Tech Stack

This project is built with a modern, robust set of technologies for a scalable and real-time experience.

### Frontend Stack

| Technology | Purpose | Version |
| :--- | :--- | :--- |
| **[React.js](https://reactjs.org/)** | UI framework and component library | 18.3.1 |
| **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** | Powerful code editor (VS Code engine) | 0.52.2 |
| **[Socket.IO Client](https://socket.io/)** | Real-time bidirectional communication | 4.8.1 |
| **[Mediasoup Client](https://mediasoup.org/)** | WebRTC media transport | 3.12.5 |
| **[Y.js](https://yjs.dev/)** | CRDT library for collaborative editing | 13.6.27 |
| **[Liveblocks](https://liveblocks.io/)** | Managed backend for Y.js sync | 3.2.0 |
| **[react-sketch-canvas](https://www.npmjs.com/package/react-sketch-canvas)** | Interactive whiteboard component | 6.2.0 |
| **[Axios](https://axios-http.com/)** | HTTP client with interceptors | 1.10.0 |

### Backend Stack

| Technology | Purpose | Version |
| :--- | :--- | :--- |
| **[Node.js](https://nodejs.org/)** | JavaScript runtime | 18+ |
| **[Express](https://expressjs.com/)** | Web framework and routing | 5.1.0 |
| **[Socket.IO](https://socket.io/)** | WebSocket server for real-time events | 4.8.1 |
| **[Mediasoup](https://mediasoup.org/)** | Selective Forwarding Unit (SFU) for WebRTC | 3.16.6 |
| **[MongoDB](https://www.mongodb.com/)** | NoSQL database for user & session data | 8.16.0 (Mongoose) |
| **[JWT](https://jwt.io/)** | Authentication tokens | 9.0.2 |
| **[Liveblocks Node](https://liveblocks.io/)** | Server-side Liveblocks session management | 3.2.0 |

### External Services

| Service | Purpose |
| :--- | :--- |
| **[Piston API](https://github.com/engineer-man/piston)** | Sandboxed code execution for 100+ languages |
| **[Google OAuth 2.0](https://developers.google.com/identity)** | Social login provider |
| **[Liveblocks](https://liveblocks.io/)** | Managed CRDT synchronization backend |

---

## 📁 Project Structure

```
SynCode/
├── backend/                          # Node.js/Express server
│   ├── src/
│   │   ├── index.js                 # Server entry point
│   │   ├── controllers/
│   │   │   └── user.controller.js   # Auth logic (signup, login, logout)
│   │   ├── models/
│   │   │   └── user.model.js        # MongoDB user schema
│   │   ├── routes/
│   │   │   ├── auth.route.js        # Auth endpoints
│   │   │   └── liveblocks.route.js  # Liveblocks session auth
│   │   ├── middleware/
│   │   │   └── auth.middleware.js   # JWT verification middleware
│   │   └── lib/
│   │       ├── db.js                # MongoDB connection
│   │       ├── socekt.js            # Socket.IO setup
│   │       ├── state.js             # Global room state management
│   │       ├── roomManager.js       # Room lifecycle handlers
│   │       ├── mediasoupManager.js  # WebRTC signal handlers
│   │       └── mediasoup.js         # Mediasoup worker/router setup
│   └── package.json
│
├── frontend/                         # React/Vite application
│   ├── src/
│   │   ├── main.jsx                 # React entry point
│   │   ├── App.jsx                  # Router and layout
│   │   ├── index.html               # HTML template
│   │   ├── context/
│   │   │   ├── AuthProvider.jsx     # Global auth state
│   │   │   └── socket.jsx           # Socket.IO provider
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Landing page
│   │   │   ├── Login.jsx            # Login form
│   │   │   ├── Signup.jsx           # Registration form
│   │   │   ├── CodeEditor.jsx       # Main IDE (450+ lines)
│   │   │   └── Canvas.jsx           # Whiteboard
│   │   ├── components/
│   │   │   ├── EditorHeader.jsx     # Editor toolbar
│   │   │   ├── LanguageSelector.jsx # Language dropdown
│   │   │   ├── RoomView.jsx         # Video grid
│   │   │   ├── VideoPlayer.jsx      # Single video stream
│   │   │   ├── Input.jsx            # stdin panel
│   │   │   ├── Output.jsx           # stdout panel
│   │   │   ├── Navbar.jsx           # Navigation bar
│   │   │   ├── Footer.jsx           # Footer
│   │   │   ├── PersistLogin.jsx     # Token persistence wrapper
│   │   │   ├── RedirectIfAuth.jsx   # Auth-based routing
│   │   │   └── Alert.jsx            # Modal dialogs
│   │   ├── hooks/
│   │   │   └── useMediasoup.js      # WebRTC lifecycle hook
│   │   ├── api/
│   │   │   ├── axios.js             # Axios instance with interceptors
│   │   │   ├── liveblocks.js        # Liveblocks auth
│   │   │   └── piston.js            # Code execution API client
│   │   ├── utils/
│   │   │   ├── constants.js         # Language versions & code snippets
│   │   │   ├── languageIcons.js     # Language icon mappings
│   │   │   └── mediasoup-client.js  # Mediasoup client helpers
│   │   ├── styles/                  # Component CSS files
│   │   └── App.css                  # Global styles
│   ├── vite.config.js
│   └── package.json
│
├── README.md                        # This file
└── .env.example                     # Environment variables template
```

---

## 🔧 Installation

### Prerequisites

- **Node.js** 18.0+ ([Download](https://nodejs.org/))
- **npm** 9.0+ or **yarn**
- **MongoDB** 4.4+ (Local or MongoDB Atlas)
- **Git**

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev

# Or build for production
npm run build
npm start
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build
npm preview
```
---

## 🌍 Environment Variables

### Backend (.env)

```env
# Server Configuration
PORT=5000
CORS_ORIGIN=http://localhost:5173,http://192.168.0.113:5173

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/codetogether?retryWrites=true

# Authentication
ACCESS_TOKEN_SECRET=your-super-secret-access-token-key
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key
REFRESH_TOKEN_EXPIRY=7d

# Liveblocks (for CRDT sync backend)
LIVEBLOCKS_SECRET_KEY=sk_live_yourliveblockskey

# Mediasoup
ANNOUNCED_IP=your.public.ip.address  # For NAT traversal; leave as 0.0.0.0 for local dev

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Frontend (.env)

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5000

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_LOGIN_API=https://www.googleapis.com/oauth2/v2/userinfo

# Code Execution
VITE_PISTON_API_URL=https://emkc.org/api/v2/piston/execute

# Liveblocks
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_live_yourliveblockspublickey
```

---

## 📚 API Documentation

### Authentication Endpoints

**POST** `/api/auth/signup`
- Register new user
- Body: `{ fullname, email, password }`
- Response: `{ accessToken, user }`

**POST** `/api/auth/login`
- Authenticate with credentials
- Body: `{ email, password }`
- Response: `{ accessToken, user }`

**POST** `/api/auth/google-login`
- OAuth login/registration
- Body: `{ email, fullname, avatar }`
- Response: `{ accessToken, user }`

**POST** `/api/auth/logout`
- Invalidate refresh token
- Requires: Authorization header
- Response: `{ success, message }`

**POST** `/api/auth/refresh-token`
- Refresh expired access token
- Response: `{ accessToken, user }`

### Liveblocks Endpoints

**POST** `/api/liveblocks/auth`
- Get Liveblocks session token
- Requires: Authorization header
- Body: `{ room }`
- Response: Liveblocks session data

### WebSocket Events (Socket.IO)

#### Room Management
- `create-room` - Create new collaborative room
- `join-room` - Join existing room
- `leave-room` - Leave current room
- `update-user-list` - Broadcast user list changes

#### Media Management
- `get-router-rtp-capabilities` - Request WebRTC capabilities
- `create-webrtc-transport` - Initialize send/recv transport
- `connect-transport` - Establish DTLS connection
- `produce` - Create media producer (video/audio/screen)
- `consume` - Subscribe to remote producer
- `close-producer` - Stop media stream
- `resume-consumer` - Unmute remote stream

---

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help makes CodeTogether better.

### Development Workflow

1. **Fork the Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/CodeTogether.git
   cd CodeTogether
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/YourFeatureName
   ```

3. **Make Your Changes**
   - Follow existing code style and structure
   - Write clear, descriptive commit messages
   - Test thoroughly before submitting

4. **Commit and Push**
   ```bash
   git commit -m "feat: add description of your feature"
   git push origin feature/YourFeatureName
   ```

5. **Open a Pull Request**
   - Provide a clear description of changes
   - Link any relevant issues
   - Wait for review


### Areas for Contribution

- [ ] Performance optimizations
- [ ] Additional language support for code execution
- [ ] Enhanced whiteboard features
- [ ] Improved UI/UX
- [ ] Documentation and tutorials
- [ ] Bug fixes and stability improvements

---

## 📖 Documentation

### Additional Resources

- [Liveblocks Documentation](https://liveblocks.io/docs) - CRDT synchronization
- [Mediasoup Documentation](https://mediasoup.org/documentation/v3/) - WebRTC SFU
- [Piston API Documentation](https://github.com/engineer-man/piston) - Code execution

---

## 🐛 Troubleshooting

### Common Issues

#### WebRTC Connection Failed
- **Issue**: Video/audio not connecting on Render.com
- **Solution**: Render.com doesn't support UDP. Deploy backend to a VPS with proper networking (AWS, DigitalOcean, etc.)

#### CORS Errors
- **Issue**: Frontend can't reach backend API
- **Solution**: Update `CORS_ORIGIN` in backend `.env` to match frontend domain

#### MongoDB Connection Error
- **Issue**: "MongooseError: Cannot connect to MongoDB"
- **Solution**: 
  - Verify `MONGODB_URI` is correct
  - Check firewall/IP whitelist on MongoDB Atlas
  - Ensure MongoDB is running if using local instance

#### Token Expiration Issues
- **Issue**: "Unauthorized" errors after token expires
- **Solution**: Token refresh is automatic via axios interceptors. Check browser cookies are enabled.

#### Code Execution Timeout
- **Issue**: Piston API requests timeout
- **Solution**: 
  - Verify internet connection
  - Check `VITE_PISTON_API_URL` is reachable
  - Reduce code size or stdin size

---

## 📋 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This project uses several open-source libraries:
- Y.js - MIT License
- Mediasoup - ISC License
- Express - MIT License
- React - MIT License
- Monaco Editor - MIT License

---

## 🙏 Acknowledgments

CodeTogether wouldn't be possible without these amazing projects and communities:

**Core Infrastructure**
- [Microsoft](https://github.com/microsoft) for Monaco Editor
- [Mediasoup Team](https://github.com/versatica) for WebRTC scaling
- [Y.js Team](https://github.com/yjs) for CRDT synchronization
- [Socket.IO](https://socket.io/) for real-time communication

**Sponsors & Contributors**
- [Liveblocks](https://liveblocks.io/) for managed CRDT backend
- [Piston](https://github.com/engineer-man/piston) for secure code execution
- All open-source contributors who reported issues and suggested improvements

**Inspiration**
- Google Docs for collaborative editing paradigm
- VS Code for editor experience
- Figma for real-time collaboration UI patterns

---

## 📞 Support & Contact

### Get Help

- **Issues**: [GitHub Issues](https://github.com/DipanshuRai/CodeTogether/issues) for bug reports
- **Discussions**: [GitHub Discussions](https://github.com/DipanshuRai/CodeTogether/discussions) for questions
- **Email**: [dipanshurai933@gmail.com](mailto:dipanshurai933@gmail.com)

### Stay Connected

- **GitHub**: [@DipanshuRai](https://github.com/DipanshuRai)
- **LinkedIn**: [Dipanshu Rai](https://www.linkedin.com/in/dipanshu-rai-1b913025b/)

---

<div align="center">

**Made with ❤️ by [Dipanshu Rai](https://github.com/DipanshuRai)**

If you found this project helpful, please consider giving it a ⭐ on GitHub!

[⬆ Back to Top](#codetogether---real-time-collaborative-ide)

</div>