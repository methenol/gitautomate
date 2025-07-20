# GitAutomate: PRD to Project Plan

GitAutomate is a powerful web application designed to streamline the initial phases of a software project. By leveraging generative AI, it transforms a Product Requirements Document (PRD) into a comprehensive project plan, including software architecture, technical specifications, and a granular list of actionable development tasks. You can then export this plan or automatically create issues in your GitHub repository. This is a simple local tool that makes it easier to task project building to AI SWE coders like OpenHands or Copilot Coding Agent. You can use the markdown task files with Claude Code or Roo Code as well.

## Features

- **AI-Powered Planning**: Uses Google's Gemini models to generate architecture, specifications, and tasks.
- **Step-by-Step Workflow**: A guided, multi-step process from PRD to final output.
- **Configurable AI**: Select from available Google AI models to suit your needs.
- **TDD Mode**: Optionally generate tasks and implementation steps following Test-Driven Development principles.
- **GitHub Integration**: Automatically create a main tracking issue and sub-issues for each task in your selected repository.
- **Local Mode**: Don't want to connect to GitHub? Export the entire project plan as a structured `.zip` file.
- **Interactive Task Management**: View, edit, and refine the AI-generated task details before exporting.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **AI Backend**: [Firebase Genkit](https://firebase.google.com/docs/genkit)
- **UI**: [React](https://reactjs.org/), [ShadCN UI](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: React State & Hooks
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **Containerization**: [Docker](https://www.docker.com/)

---

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- **Node.js**: Version 20 or later.
- **npm** package manager.
- **Docker** and **Docker Compose** (for containerized deployment).
- A **Google AI API Key**. You can obtain one from [Google AI Studio](https://aistudio.google.com/app/apikey).
- (Optional) A **GitHub Personal Access Token** with `repo` scope if you wish to use the GitHub integration feature.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/methenol/gitautomate.git
    cd gitautomate
    ```

2.  **Set up environment variables:**
    Create a new file named `.env` in the root of the project and add your Google AI API Key.

    ```dotenv
    # .env
    GOOGLE_API_KEY="YOUR_GOOGLE_AI_API_KEY"
    ```
    This key will be used by default for all AI operations. You can also override this by providing a key in the application's UI settings.

### Running the Application (Local npm)

This method requires two concurrent terminal sessions to run: one for the Next.js frontend and one for the Genkit AI backend.

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the Genkit development server:**
    Open a terminal and run the following command. This will start the Genkit backend and make the AI flows available.

    ```bash
    npm run genkit:watch
    ```

3.  **Run the Next.js development server:**
    Open a *second* terminal and run the following command to start the frontend application.

    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:9002`.

### Running with Docker (Recommended)

This method uses Docker Compose to build the necessary images and run the application in a containerized environment. It simplifies the setup by managing both the Next.js and Genkit services for you.

1.  **Build and start the services:**
    From the root of the project directory, run:
    ```bash
    docker-compose up --build
    ```
    This command will build the Docker image for the application and start both the Next.js and Genkit services. The `-d` flag can be added to run the containers in detached mode (in the background).

2.  **Access the application:**
    Once the containers are running, the application will be available at `http://localhost:9002`.

3.  **Stopping the services:**
    To stop the application, press `Ctrl+C` in the terminal where `docker-compose` is running. If you are running in detached mode, use the following command:
    ```bash
    docker-compose down
    ```

---

## How to Use GitAutomate

Using the application involves a simple, sequential process.

### 1. Configure Settings

- Click the **Settings** icon (⚙️) in the top-right corner.
- **GitHub Token**: Add your GitHub Personal Access Token here to enable fetching your repositories and creating issues. This is stored only in your browser's local storage.
- **Google AI API Key**: You can add a key here to override the one in your `.env` file. This is useful for testing different keys without restarting the application.
- **AI Model**: Select the generative model you want to use. The list is populated automatically based on your API key. `gemini-1.5-flash-latest` is recommended for speed and cost-effectiveness.
- **Use TDD**: Toggle this switch to generate tasks and implementation plans that follow Test-Driven Development principles.

### 2. Select Repository

- **Local Mode**: By default, "Local Mode" is selected. In this mode, all generated data can be exported as a `.zip` file at the end of the process. No GitHub connection is required.
- **GitHub Repository**: If you have configured your GitHub token, a dropdown list of your repositories will appear. Select the repository where you want to create the implementation plan issues.

### 3. Provide PRD

- Paste your Product Requirements Document into the text area. Be as descriptive as possible for the best results.
- Click **"Generate Architecture"**. The AI will process your PRD and return a proposed architecture and technical specifications.

### 4. Review Plan

- The generated architecture and specifications will be displayed in editable text areas.
- You can review and modify the AI's output to better fit your project's needs.
- Once you are satisfied, click **"Generate Tasks"**. The AI will now break down the plan into a list of granular, actionable tasks.

### 5. Review & Refine Tasks

- The AI will generate a list of task titles and then, one by one, research each task to generate detailed implementation notes (context, steps, acceptance criteria).
- Click on any task to open a detailed view. You can edit the implementation details in the text editor. A live preview of the GitHub issue markdown is shown on the right.
- If research for a task fails, you can click the **"Retry Research"** button within the task detail view.

### 6. Export or Create Issues

- **Export Data**: Click the **"Export Data"** button at any time after tasks have been generated. This will download a `.zip` file containing the PRD, architecture, specifications, and all tasks in markdown format. This is the only option available in Local Mode.
- **Create GitHub Issue**: If you have selected a repository, click the **"Create GitHub Issue"** button. This will:
    1. Create individual issues in your repository for each task.
    2. Create a main "Implementation Plan" parent issue that links to all the sub-task issues.
    3. Provide you with a link to the main plan issue.
