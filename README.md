# NoteSharp-L02
By Nathan, Enock, Levi, Dhruv


Branch Architecture   
|-Main: is the Deployment branch, the public build of the application  
|- dev: is effectively the main development branch where changes are merged and getting ready for a new deploy to main. Every feature and bug fix that is ready gets merged into dev. 


Every feature, bug fix, etc., will have its own branch

# Project Charter # 

Identification Section 

Project Name: Note#

Date: September 18, 2025

Version: 0.1

Sponsor: UBCO

Project Manager: Sarker 

### Overview of the Project (Background) ###

The project is inspired by Milanote, a tool for visual organization and collaboration. However, current tools often lack affordable options and features that meet the needs of technical disciplines such as computer science. Our solution will deliver a free-lite, web-based collaboration platform where users can create boards, add customizable cards, upload images, draw arrows/lines, and organize information.

What differentiates Note# is its STEM-oriented functionality: support for LaTeX math notation, code block highlighting, structured diagrams (e.g., class diagrams, flowcharts, Fourier transforms), and markdown-based notes. This tool will provide a unified workspace for students, small teams, creatives, and technical professionals to ideate, structure, and collaborate.

### Project Purpose (Objectives) ###

Create a unified digital collaboration and design tool that bridges the gap between technical and creative workflows, enabling seamless integration between computer science/engineering and creative professionals (artists, illustrators, designers, mathematicians). The platform will offer specialized and general tools to meet diverse user needs, featuring an intuitive design and a "pay for what you use" pricing structure for accessibility and flexibility, with a set-it-and-forget-it pricing model. It will allow for organizing notes, creating diagrams, and making comprehensive flowcharts, mood boards, and more with a set of simple, easy-to-use tools that are both flexible and powerful.

Objectives: 
Responsive Web Application, UI, and functional synchronization across devices (3-second load time, and snappy UI) 
Easy management of notes and boards by creating specific cards (containers) to which users can add to their board. 
Note card: the base card that can be resized, coloured, and supports both markdown (+ code block highlighting) and LaTeX 
Board card: the base container that holds all other cards in view, including other boards. 
Group card: a Note Card holder that organizes Note cards in a list view/ grid view, queue view
Line tool: a Fourier transform. Arrow tool to connect cards with options for adding a label to it, and arrow endpoints, for general computer science and engineering

User Authentication and data storage containers for instant login and signing out
The project will have its first Launch for the prototype on November 6th, with completed authentication, cloud storage, and  Note card and board card, and basic line tool
The project will have its second and final release on December 1st, with the completed scope and polish.
Unit tests and user testing will be available with each feature
Additional features will be included on an as-needed basis


# Scope #

In Scope
The project will include the following functionality:

### Authentication & Security ###

- Secure user authentication
- User sign-in and log-out
- Account and server administration for designated Admin users
- Promote existing accounts to admin via `POST /api/promote-user` (Authorization header with admin ID token required). Body accepts either a `uid` or `email` plus the desired `role` (e.g., `"admin"`). Successful calls update the user’s Firestore metadata (`role` + `isAdmin`) so admin-only areas unlock immediately.

### Board & Card Management ###

- Ability to create and manage boards that house cards and diagrams
- Collapsible & grouped cards (nesting or collapsing to reduce clutter)
- Card customization (resizing, colors, text editing, image insertion)
- Note card supporting Markdown, LaTeX, and code block highlighting
- Group card to organize Note cards in list/grid/queue view
- Board card as a container that can hold other cards/boards
- Additional card types:
  - Table card
  - To-do card
  - Free-draw card (with pen/pressure support)

### Connections & Diagramming ###

- Arrow and line tools with labels and endpoints
- Support for data flow diagrams, class diagrams, and basic CS/engineering notations
- Fourier transform visualization tool

### User Roles & Permissions ###

- Basic Users: manage personal boards and content
- Admins: account and server management
- Optional elevated roles (e.g., instructor access)


### Cloud Storage & Data Handling ###

- Automatic cloud save of boards and cards
- Storage quotas for free-tier users
- Firebase-based hosting and data persistence

### Cross-Device Responsiveness ###

- Optimized UI for desktop, tablet, and mobile
- Touch/pen input support for drawing and navigation

### Version Control & Undo/Redo ###

- Undo/redo functionality for board edits
- Lightweight version history for boards

### Export/Import Options ###

- Export boards or notes as PDF, image, or Markdown
- Import structured text/Markdown into cards

### Notifications ###

- Basic in-app notifications for login events, edits, or board updates

### Accessibility ###

- Keyboard shortcuts for navigation
- Basic screen reader compatibility and contrast adherence


### Quality Assurance ###

- Implementation of a unit testing framework
- Continuous integration and user testing for each major feature


### Monetization ###

- Payment processing functionality
- Freemium model with “pay-for-what-you-use” options

## Out of Scope ##

The project will not include the following features:

- Real-time collaborative editing (multi-user simultaneous updates)
- Video upload and playback within cards
- Advanced project management tools (e.g., Gantt charts, sprint boards)
- Offline capabilities (editing or viewing without internet)
- External API integrations (e.g., Slack, Jira, GitHub)
- AI-driven features (auto-summarization, auto-diagramming, recommendations)
- Advanced analytics and reporting dashboards
- Organization-level account/role hierarchies (beyond Admin vs. Basic User)
- Push/email notifications (only in-app notifications are included)
- Large-scale enterprise security and compliance frameworks (e.g., SSO, SOC2, HIPAA)

# Technology Stack Selection #
- Frontend: React 18+ with TypeScript
- CSS Framework: Tailwind
- Backend: Node.js with Express.js
- Database: Firebase Firestore
- Authentication: Firebase Auth
- Storage: Firebase Storage
- Real-time: Firebase Realtime Database + WebSockets
- Hosting: Firebase Hosting
- Functions: Firebase Cloud Functions
- Payment: Stripe Integration



