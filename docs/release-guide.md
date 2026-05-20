# Release Guide (Publishing New Versions)

This guide documents the steps required to compile, package, and publish a new version of **FL-Init** to GitHub, allowing existing users to receive automatic updates via `electron-updater`.

---

## 📋 Release Checklist

Follow these 5 steps every time you want to release a new version of the application:

### Step 1: Update the Version in `package.json`
Open the `package.json` file and update the `"version"` field value following [SemVer](https://semver.org/) rules (e.g., from `1.0.5` to `2.0.0` for a major refactor or breaking change).
```json
{
  "name": "flinit",
  "version": "2.0.0",
  ...
}
```

### Step 2: Verify Your GitHub Token (`GH_TOKEN`)
Ensure you have configured a valid GitHub access token in your local [.env](file:///I:/Izeta/Documentos/Proyectos/FL-Init/.env) file:
*   The file must contain: `GH_TOKEN="your_github_pat_here"`
*   *Note:* This token must be a **Personal Access Token (PAT) Classic** from your GitHub account with the `repo` scope enabled. This provides write access to your repository releases (`spewite/FL-Init`). If your token has expired, generate a new one on GitHub under *Settings > Developer Settings > Personal access tokens > Tokens (classic)*.

### Step 3: Recompile Python Dependencies (Optional)
If you have modified dependencies in `requirements.txt` or modified any Python scripts, rebuild the standalone portable Python environment locally by running:
```bash
npm run build:python
```
This script downloads a clean runtime and installs all requirements in the distribution folder `dist/python`.

### Step 4: Compile and Upload the Executables
Run the automated publication script from the root directory of your project:
```bash
npm run publish
```
This command performs the following tasks automatically:
1.  Loads the `GH_TOKEN` environment variable from your `.env` file.
2.  Compiles the main process TypeScript files (`src/main`) and packages the frontend using Webpack in production mode.
3.  Launches `electron-builder` to package the application (creating the NSIS installer for Windows).
4.  Creates a **Draft Release** on your GitHub repository and automatically uploads the executable (`.exe`) installer as an asset.

### Step 5: Publish the Release on GitHub
Once the command in your terminal completes successfully:
1.  Go to the Releases page of your GitHub repository:
    👉 [https://github.com/spewite/FL-Init/releases](https://github.com/spewite/FL-Init/releases)
2.  You will find a new release marked as **Draft** with your version number (e.g., `v2.0.0`) and the installer files attached as assets.
3.  Click **Edit** on that draft.
4.  Add a descriptive title and release notes outlining the changes in this version.
5.  Click the **Publish release** button.

---

## 🔄 How Users Receive Updates

The application is integrated with an automatic updater system configured in [updater.ts](file:///I:/Izeta/Documentos/Proyectos/FL-Init/src/main/updater.ts):
1.  On startup, the app checks the GitHub repository for new public releases.
2.  If it detects a version higher than the currently installed one, it displays a dialog informing the user that an update is available.
3.  It downloads the updated installer in the background and restarts the application to apply it.
