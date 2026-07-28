# UnifyOS Workflow Engine

UnifyOS is a powerful, unified workflow automation platform that connects your favorite productivity tools. Manage your notifications, automate repetitive tasks, and gain insights into your productivity from a single dashboard.

## 🚀 Features

- **Unified Inbox**: View and manage notifications from all your connected apps in one place.
- **Workflow Builder**: Create complex automations between apps with a simple drag-and-drop interface.
- **App Integrations**: Seamlessly connect with Google (Gmail & Calendar), Slack, Notion, Trello, Asana, and Monday.com.
- **Productivity Analytics**: Track time saved and workflow efficiency.
- **Secure & Private**: All your credentials are encrypted and stored securely.

## 🛠️ Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, Lucide React
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL / Supabase
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database (or Supabase project)
- API keys for the integrations you wish to enable

## ⚙️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/humblewriter01/unifyos-workflow-engine.git
cd unifyos-workflow-engine
```

### 2. Install dependencies
```bash
# Install root dependencies
npm install

# Install app-specific dependencies
cd apps/frontend && npm install
cd ../api && npm install
```

### 3. Environment Configuration
Copy the `.env.example` file to `.env.local` in the root directory and fill in your API keys:
```bash
cp .env.example .env.local
```

### 4. Database Setup
```bash
cd apps/api
npx prisma generate
npx prisma db push
```

### 5. Run the Application
Start the API server:
```bash
cd apps/api
npm run dev
```

Start the Frontend:
```bash
cd apps/frontend
npm run dev
```

The application will be available at `http://localhost:3000`.

## 🔌 Activating Integrations

To activate an integration, simply add the corresponding API keys to your `.env.local` file. The platform currently supports:

- **Google (Gmail & Calendar)**: Automate emails and schedule events.
- **Slack**: Send messages and receive real-time notifications.
- **Notion**: Create pages and sync database updates.
- **Trello/Asana/Monday.com**: Manage tasks and project boards across different platforms.

## 📄 License

This project is licensed under the MIT License.
