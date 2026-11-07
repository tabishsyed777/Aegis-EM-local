# Aegis-EM Command Center

A polished, interactive emergency response command-center demo. It shows a multi-agent incident workflow, a schematic Mumbai map, a simulated response fleet, and a commander approval step for a public safety alert.

## Run locally

Open `index.html` in a modern browser. No install, account, API key, or server is required.

## Try the demo

1. Select an incident to move the map marker and inspect its priority.
2. Click **Run demo incident** to animate triage, hazard verification, and logistics, then add a simulated collision to the incident list.
3. Click **Review & approve** to open the commander gate. Approval changes the demo state in the page only.

## GitHub Pages

The included GitHub Actions workflow deploys this static site to GitHub Pages whenever changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** if it is not already selected. Once the first deployment succeeds, open the Pages URL shown in the repository's **Settings → Pages**.

## Scope

This is a front-end simulation. The agent steps use scripted demo data; they do not call an AI model, GIS feed, fleet database, emergency service, or public alert system. The map is schematic, unit positions and ETAs are illustrative, and the approval control never sends an alert.
