# Falcon FF
## Visuals and Stats for our Sleeper League

---

This project is a fantasy football dashboard that provides in-depth analytics and visualizations for our Sleeper league. It's designed to be deployed using GitHub Actions, automatically updating every hour to provide the latest stats and power rankings.

## ✨ Features

- **Dynamic Power Rankings**: A weighted ranking system that evolves from projection-based to performance-based as the season progresses.
- **F-DVOA Ratings**: A DVOA-like metric to measure team performance against the league average, adjusted for opponent strength.
- **Weekly Analysis**: A detailed breakdown of the current week's projections and a season-long view of positional scoring averages.
- **Multi-Year History**: A dropdown menu to easily view and compare stats from the last three seasons.
- **Automated Updates**: The dashboard automatically fetches the latest data every hour, so you always have the most current information.

## 🚀 Deployment & Automation Options

You can deploy and automate this dashboard in one of two ways. Choose the option that best fits your needs.

### Option 1: Deploy to GitHub Pages (Recommended)

This method uses GitHub Actions to automatically update your site every hour. It's free and doesn't require you to run your own server.

1.  **Enable GitHub Pages**:
    -   Go to your repository's **Settings** tab.
    -   Navigate to the **Pages** section.
    -   Under "Branch," select your main branch (e.g., `main`) and click **Save**.

2.  **Push to GitHub**:
    -   Commit and push all the project files (`app.py`, `index.html`, `.github/workflows/update-stats.yml`, etc.) to your repository.
    -   The GitHub Actions workflow will automatically start running on its hourly schedule. You can also trigger it manually from the **Actions** tab in your repository.

### Option 2: Run Locally with Docker

This method is best for local development and testing. It uses Docker Compose to run the application on your machine.

1.  **Prerequisites**:
    -   Python 3.8+
    -   Docker and Docker Compose

2.  **Clone the repository:**
    ```bash
    git clone [https://github.com/megacorvega/falcon-ff](https://github.com/megacorvega/falcon-ff)
    cd falcon-ff
    ```

3.  **Build and run with Docker Compose:**
    ```bash
    docker-compose up --build
    ```

4.  **View your dashboard:**
    Once the containers are running, you can access the dashboard in your web browser at `http://localhost:8080`.

## ⚙️ How It Works

-   **GitHub Actions Workflow**: The workflow defined in `.github/workflows/update-stats.yml` runs on a schedule. It sets up a Python environment, installs dependencies, executes `app.py`, and commits the newly generated data files back to the repository.
-   **Python Script (`app.py`)**: This script fetches the latest data from the Sleeper API, performs all the necessary calculations, and saves the output as JSON files (`config.json` and `data_<year>.json`).
-   **Front End (`index.html`, `script.js`)**: The `index.html` file is a static shell. The JavaScript file fetches the appropriate JSON data based on the selected year and dynamically builds all the tables and charts in the browser.

