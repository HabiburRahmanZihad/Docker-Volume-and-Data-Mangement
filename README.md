<div align="center">
  <p style="color: red; font-size: 1.4em; font-weight: bold; border: 2px solid red; padding: 14px; border-radius: 6px;">
    🚫 RESTRICTED — DO NOT COPY 🚫<br/>
    <span style="font-size: 0.85em; font-weight: normal;">
      This document is for personal study purposes only.<br/>
      Copying, reproducing, sharing, or distributing any content from this material is strictly prohibited.<br/><br/>
      ⚖️ <strong>Any unauthorized use of this content will result in immediate legal action.</strong><br/>
      <span style="font-size: 0.8em;">The author reserves all rights and will pursue copyright infringement claims to the fullest extent of the law.</span>
    </span>
  </p>
</div>

# Docker Study Notes — Volume & Data Management

> Detailed study notes on Docker volumes and data management: understanding data categories, the writable container layer, named and anonymous volumes, bind mounts, combining volumes and bind mounts to solve real problems, environment variables, and the `.dockerignore` file.

---

## Table of Contents

1. [Why Volumes and Data Management Matter](#1-why-volumes-and-data-management-matter)
2. [Understanding Data Categories](#2-understanding-data-categories)
3. [The Writable Container Layer](#3-the-writable-container-layer)
4. [Understanding Docker Volumes](#4-understanding-docker-volumes)
5. [Managing Volumes with the Docker CLI](#5-managing-volumes-with-the-docker-cli)
6. [Hands-on Docker Bind Mounts](#6-hands-on-docker-bind-mounts)
7. [Solving the Classic node_modules Problem](#7-solving-the-classic-node_modules-problem)
8. [Environment Variables and .env Files](#8-environment-variables-and-env-files)
9. [The .dockerignore File](#9-the-dockerignore-file)
10. [Quick Reference Cheat Sheet](#10-quick-reference-cheat-sheet)

---

## 1. Why Volumes and Data Management Matter

Containers are designed to be **disposable units**. This is a feature, not a bug — but it creates a fundamental challenge: where does your data live?

### Containers Are Designed To Be

- **Replaceable** — you can delete and recreate a container from its image at any time
- **Restartable** — a crashed container can restart cleanly from the same image
- **Disposable** — containers are meant to be lightweight and short-lived

### What We Store Inside Docker Containers

When your application runs inside a container, it produces and depends on data:

| Category | Examples |
|---|---|
| **Databases** | MongoDB files, PostgreSQL data, SQLite files |
| **User uploads** | Images, documents, avatars |
| **Authentication sessions** | Session tokens, JWT refresh stores |
| **Logs** | Application logs, access logs, error logs |
| **Configuration files** | Runtime-generated configs, certificates |

### The Core Problem

```
Container lifecycle without volumes:

  docker run my-app        ← container starts, app writes data to /app/data
  ... app runs, users upload files, database writes records ...
  docker rm my-app         ← container deleted
  ✗ ALL data is permanently gone

  docker run my-app        ← new container, completely empty
```

> Every time you delete a container — whether intentionally, during a crash recovery, or a deployment — all data written inside it is lost. Docker volumes solve this.

---

## 2. Understanding Data Categories

Not all data inside a Docker environment lives in the same place or has the same lifespan. Docker separates data into three distinct categories.

![Understanding Data Categories](assets/Understanding%20Data%20Categories.png)

### App Code — Baked Into the Image

- Lives inside the **Docker image** as read-only layers
- Built during `docker build` via `COPY` instructions
- **Replaced on rebuild** — when you change code and rebuild, a new image layer replaces the old one
- Examples: `server.js`, `main.py`, `index.html`

### Temp Runtime Data — Lives in the Container Layer

- Stored in the container's **writable layer** (added on top of the image when a container starts)
- **Dies with the container** — removed when the container is deleted
- Short-lived by nature
- Examples: logs written during a session, in-memory session data, temporary files

### Persistent Data — Needs a Volume

- Must be stored **outside the container** in a Docker volume
- **Survives container removal** — the volume exists independently of any container
- Can be **shared across containers**
- Examples: database files, user uploads, anything that must outlive a container

---

### Data Categories at a Glance

![Data Categories Table](assets/data%20catagories%20table.png)

| Type | Lives Where | Lifecycle |
|---|---|---|
| **App Code** | Image (read-only layers) | Until rebuild |
| **Temp Data** | Container writable layer | Until container removed |
| **Persistent Data** | Volume | Long-term |

---

## 3. The Writable Container Layer

When Docker starts a container from an image, it does NOT modify the image. Instead, it adds a **thin writable layer** on top of all the read-only image layers.

### How It Works

```
┌──────────────────────────────────┐
│  Writable Container Layer        │  ← unique to each container
│  (temp data, runtime writes)     │    deleted when container is removed
├──────────────────────────────────┤
│  Layer 5: COPY . .               │
├──────────────────────────────────┤
│  Layer 4: RUN npm ci             │  ← read-only image layers
├──────────────────────────────────┤  ← shared between all containers
│  Layer 3: COPY package*.json     │    from this image
├──────────────────────────────────┤
│  Layer 2: ENV NODE_ENV=...       │
├──────────────────────────────────┤
│  Layer 1: FROM node:20-alpine    │
└──────────────────────────────────┘
```

### Key Behaviors

- **Every container gets its own writable layer** — two containers from the same image don't share writes
- **The image layers are never modified** — writes always go to the writable layer
- **When the container is deleted, the writable layer is deleted** — all runtime data is gone
- **Multiple containers can share the same image** — they each add their own writable layer on top, keeping the image lean

### Why This Matters

```
Two containers from the same image:

  Container A (writable layer A) ─┐
                                   ├─► Shared image layers (read-only)
  Container B (writable layer B) ─┘

  Container A writes /app/data/file.txt
  Container B cannot see it — they have separate writable layers
```

This isolation is by design. But it also means: **anything written inside a container is siloed and temporary**. To share data or make it persist, you need a volume.

---

## 4. Understanding Docker Volumes

A **Docker volume** is a storage mechanism managed by Docker that exists **outside the container's writable layer**. Data in a volume persists independently of any container lifecycle.

### How Volumes Connect to Containers

```
Host Machine
┌──────────────────────────────────────────────────────┐
│                                                      │
│   Docker Volume (my-data)                            │
│   /var/lib/docker/volumes/my-data/_data/             │
│              │                                       │
│              │ mounted at /app/data                  │
│              ▼                                       │
│   ┌──────────────────────┐                           │
│   │  Container           │                           │
│   │  /app/data  ─────────┼──► writes go to volume   │
│   │  /app/code           │                           │
│   └──────────────────────┘                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

When the container is removed, the volume (and its data) **remains on the host**.

---

### Docker Volume Types

![Docker Volume Types](assets/docker%20volume%20types.png)

Docker supports two types of volumes:

| Type | Name | Easy to Manage | Reusable |
|---|---|---|---|
| **Anonymous** | Random ID (e.g., `a3f7b2...`) | Hard | Limited |
| **Named** | Custom name (e.g., `my-data`) | Easy | Yes |

#### Anonymous Volumes

```bash
docker run -v /app/data my-app
```

- Docker assigns a random ID as the name
- Hard to reference later — you can't easily reattach it to a new container
- Suitable for truly temporary data you don't need to identify later
- Cleaned up with `docker volume prune`

#### Named Volumes — Recommended

```bash
docker run -v my-data:/app/data my-app
```

- You choose the name — easy to reference, inspect, and reuse
- Can be attached to any container: `docker run -v my-data:/app/data another-container`
- Persists until you explicitly remove it
- **Always use named volumes for production data**

---

### Volume vs No Volume

```
Without volume:                       With named volume:
  Container deleted                     Container deleted
  → data gone ✗                        → volume persists ✓

  New container                         New container
  → starts empty ✗                     → mounts same volume, data intact ✓
```

---

## 5. Managing Volumes with the Docker CLI

### Create a Named Volume

```bash
docker volume create my-data
```

Creates a named volume without running any container. Useful to pre-create volumes before running services.

---

### Use a Volume When Running a Container

```bash
# Named volume (recommended)
docker run -v my-data:/app/data my-app

# Anonymous volume
docker run -v /app/data my-app
```

**Syntax breakdown:**
```
docker run -v my-data:/app/data my-app
              ───────  ──────────
              volume   path inside
              name     the container
```

---

### List All Volumes

```bash
docker volume ls

# Output:
# DRIVER    VOLUME NAME
# local     my-data
# local     a3f7b2c8d1e49f...  ← anonymous (random ID)
```

---

### Inspect a Volume

```bash
docker volume inspect my-data

# Returns JSON with:
# - Name
# - Mountpoint (where Docker stores the data on the host)
# - Creation date
# - Labels
```

---

### Remove a Volume

```bash
# Remove a specific volume
docker volume rm my-data

# Remove all volumes not used by any container
docker volume prune
```

> You **cannot** remove a volume that is currently mounted by a running container. Stop and remove the container first.

---

### Full Volume Command Reference

| Command | Example | What It Does |
|---|---|---|
| `docker volume create` | `docker volume create my-data` | Create a named volume |
| `docker volume ls` | `docker volume ls` | List all volumes |
| `docker volume inspect` | `docker volume inspect my-data` | View volume details |
| `docker volume rm` | `docker volume rm my-data` | Remove a specific volume |
| `docker volume prune` | `docker volume prune` | Remove all unused volumes |

---

## 6. Hands-on Docker Bind Mounts

A **bind mount** maps a directory from your **host machine** directly into the container. Unlike named volumes (which Docker manages), bind mounts point to a specific path you control.

### Named Volume vs Bind Mount

| | Named Volume | Bind Mount |
|---|---|---|
| **Location** | Managed by Docker (`/var/lib/docker/volumes/`) | Any path you specify on the host |
| **Control** | Docker controls where data lives | You control the exact path |
| **Portability** | Portable across environments | Tied to host path |
| **Best for** | Production persistent data | Local development (live code sync) |
| **Syntax** | `-v my-vol:/container/path` | `-v /host/path:/container/path` |

---

### Bind Mount Syntax

```bash
# Linux / macOS:
docker run -v $(pwd):/app my-app

# Windows (PowerShell):
docker run -v ${PWD}:/app my-app

# Explicit host path:
docker run -v /Users/zihad/myproject:/app my-app
```

---

### Live Development with Bind Mounts + nodemon

The key use case for bind mounts during development: **see your code changes instantly inside the container without rebuilding the image**.

```bash
docker run -it \
  --name bind-demo \
  -v "${PWD}:/app" \
  -w /app \
  -p 5000:5000 \
  node:20-alpine \
  sh -c "npm install -g nodemon && npm install && nodemon --watch /app --legacy-watch index.js"
```

**Flag-by-flag breakdown:**

| Flag | Value | Purpose |
|---|---|---|
| `-it` | — | Interactive terminal (keeps the shell alive) |
| `--name` | `bind-demo` | Give the container a readable name |
| `-v "${PWD}:/app"` | — | Bind mount current directory into `/app` |
| `-w /app` | — | Set working directory inside the container |
| `-p 5000:5000` | — | Expose port 5000 to the host |
| `node:20-alpine` | — | Use Node.js 20 on Alpine (no custom image needed) |
| `sh -c "..."` | — | Run a shell command: install nodemon and start watching |

**What `--legacy-watch` does:** Enables polling-based file watching. Required when the host filesystem doesn't support native inotify events (common on Windows and macOS with Docker Desktop).

---

### How Bind Mount Live Reload Works

```
Host machine                     Container (/app)
/your/project/index.js  ──────►  /app/index.js
       │                               │
   You edit                        nodemon sees
   index.js                        the change
       │                               │
       └───────────────────────────────┘
              (same file via bind mount)
                         │
                    nodemon restarts
                    the Node process
```

No image rebuild needed. Changes on your host are instantly visible inside the container.

---

## 7. Solving the Classic node_modules Problem

When you use a bind mount for development, you hit a common problem: the bind mount **overwrites** the container's `/app` directory with your host's directory — including (or rather, excluding) `node_modules`.

### The Problem

```
Host directory (mounted into container):
  /your/project/
    index.js
    package.json
    ← no node_modules (it's in .gitignore / .dockerignore)

Container /app after bind mount:
  /app/
    index.js
    package.json
    ← node_modules is GONE — the bind mount replaced the entire /app directory
```

Your app crashes because `node_modules` doesn't exist inside the container.

---

### Three Approaches Compared

![Let's Solve a Classic node_modules Related Problem](assets/lets%20solve%20a%20classic%20node_modules%20related%20problem.png)

#### Approach 1 — Build Image Only (No Bind Mount)

```bash
docker build -t my-app .
docker run -p 5000:5000 my-app
```

| Feature | Status |
|---|---|
| `node_modules` in image | ✓ Yes — built by `RUN npm ci` |
| `node_modules` inside container | ✓ Yes |
| Hot reload | ✗ No — code is baked into the image |
| Overall | Everything built into image, no live code changes |

**Problem:** Every code change requires a full `docker build`. Slow for development.

---

#### Approach 2 — Bind Mount Without Volume

```bash
docker run -v "${PWD}:/app" -p 5000:5000 my-app
```

| Feature | Status |
|---|---|
| `node_modules` in image | ✓ Built during `docker build` |
| `node_modules` after bind mount | ✗ Replaced/hidden by the bind mount |
| Hot reload | ✓ Code changes reflected instantly |
| Overall | Quick code updates, but dependency issues |

**Problem:** The bind mount overlays `/app` with your host directory, which has no `node_modules`. The container can't find its packages.

---

#### Approach 3 — Bind Mount + Named Volume (The Fix)

```bash
docker run \
  -v "${PWD}:/app" \
  -v node_modules:/app/node_modules \
  -p 5000:5000 \
  my-app
```

| Feature | Status |
|---|---|
| `node_modules` | ✓ Protected in a named volume |
| `node_modules` on host | ✗ Not needed on host |
| Hot reload | ✓ Everything works |
| Overall | Ideal setup: live changes + dependency isolation |

**Why this works:** Docker resolves volume mounts in order of specificity. The named volume `-v node_modules:/app/node_modules` is more specific than the bind mount `-v "${PWD}:/app"`, so Docker uses the volume for `/app/node_modules` and the bind mount for everything else.

```
/app/          ← comes from bind mount (your host code)
/app/index.js  ← your live code
/app/node_modules/  ← comes from named volume (Docker managed)
```

> **Rule:** Bind mounts are great for code (you want live changes). Named volumes are great for `node_modules` (Docker manages them, isolated from the host).

---

## 8. Environment Variables and .env Files

Environment variables let you configure your app's behavior without changing code or rebuilding the image. Docker supports three methods to set them.

### This Project's index.js

```js
const port = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.get('/', (req, res) => {
    res.send('this is the node app running in ' + NODE_ENV + ' environment');
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
```

The app reads `PORT` and `NODE_ENV` from environment variables at runtime. No code change needed to switch environments.

---

### This Project's Dockerfile

![Dockerfile Instructions](assets/docker%20file%20instruction.png)

```dockerfile
FROM node:20-alpine

WORKDIR /app

ARG APP_ENV=development
ENV NODE_ENV=${APP_ENV}

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "index.js"]
```

**`ARG` vs `ENV` in this Dockerfile:**

| | `ARG APP_ENV` | `ENV NODE_ENV` |
|---|---|---|
| Available at | Build time only | Build time + Runtime |
| Overridable with | `--build-arg APP_ENV=production` | `-e NODE_ENV=production` at `docker run` |
| Visible in image | No (not stored in layers) | Yes (stored in image metadata) |
| Purpose | Pass a value into `ENV` during build | Set the actual runtime environment variable |

---

### Method 1 — `ENV` in Dockerfile (Baked Into the Image)

```dockerfile
ENV NODE_ENV=production
ENV PORT=5000
```

```bash
docker build -t my-app .
docker run my-app
# NODE_ENV=production, PORT=5000 — always, for every container
```

- The variable is built into the image — every container from this image gets it automatically
- Good for variables that are the same across all environments (e.g., always production)
- **Not suitable for secrets** — it's visible in the image metadata (`docker inspect`)

---

### Method 2 — `-e` Flag at `docker run` (Set at Runtime)

```bash
docker run -e PORT=3000 my-app
docker run -e NODE_ENV=staging my-app
docker run -e NODE_ENV=development -e PORT=8080 my-app
```

- Sets or overrides variables **when starting the container**
- Does NOT change the image — different containers can have different values
- Good for secrets, database URLs, API keys — things that differ per environment

---

### Method 3 — `--env-file` (Load from a File)

```bash
# .env file:
PORT=5000
NODE_ENV=staging

docker run --env-file .env my-app
```

- Loads all variables from a file — cleaner than many `-e` flags
- The `.env` file stays on your host — it is **not** copied into the image

**This project's `.env`:**

```
port = 5000
NODE_ENV = staging
```

> **Never bake a `.env` file into your image.** It belongs in `.dockerignore`. Use `--env-file` at runtime or a secrets manager in production.

---

### Priority (Who Wins When There Is a Conflict)

```
Lower priority              Higher priority
──────────────────────────────────────────────►
  --env-file   <   -e flag   <   ENV in Dockerfile (at build time)

At runtime: -e flag overrides --env-file values
```

**Practical example:**

```bash
# .env has: NODE_ENV=staging
# Command below overrides it:
docker run --env-file .env -e NODE_ENV=production my-app
# Result: NODE_ENV=production  (the -e flag wins)
```

---

### Accessing Env Vars in Node.js

```js
const port     = process.env.PORT     || 5000;          // fallback to 5000
const nodeEnv  = process.env.NODE_ENV || 'development'; // fallback to 'development'
```

The `|| fallback` pattern ensures the app works even if the variable isn't set — useful for local development without Docker.

---

## 9. The .dockerignore File

A `.dockerignore` file tells Docker which files and directories to **exclude from the build context** when you run `docker build`. It works exactly like `.gitignore` but for Docker.

### Why It Matters

When you run `docker build .`, Docker sends your entire project directory (the build context) to the Docker daemon before processing the Dockerfile. Without `.dockerignore`, this includes:

- `node_modules` — potentially hundreds of MBs, unnecessarily sent
- `.env` — contains secrets that should never be inside an image
- `Dockerfile` itself — including it is redundant and can expose your build setup

### This Project's `.dockerignore`

```
node_modules
.env
Dockerfile
```

**Line by line:**

| Entry | Why Excluded |
|---|---|
| `node_modules` | Heavy directory (potentially 200MB+). The image installs its own via `RUN npm ci` — your local copy must not overwrite it. |
| `.env` | Contains secrets (`PORT`, `NODE_ENV`, credentials). Must never be baked into an image. Use `--env-file` at runtime instead. |
| `Dockerfile` | The Dockerfile is processed by Docker directly — copying it into the image serves no purpose. |

### Common Additions for Node.js Projects

```
node_modules
.env
.env.*
Dockerfile
.git
*.log
.DS_Store
coverage/
dist/
```

### The Interaction with `COPY . .`

```dockerfile
COPY . .   # copies everything in the build context EXCEPT what's in .dockerignore
```

Without `.dockerignore`, `COPY . .` would copy `node_modules` from your host into `/app`, which would:
1. Make the build **very slow** (sending a massive build context)
2. Potentially **shadow the `npm ci` result** with your local packages
3. **Expose your `.env` secrets** inside the image

---

## 10. Quick Reference Cheat Sheet

### Volumes

| Command | Example | What It Does |
|---|---|---|
| `docker volume create` | `docker volume create my-data` | Create a named volume managed by Docker |
| `docker volume ls` | `docker volume ls` | List all volumes |
| `docker volume inspect` | `docker volume inspect my-data` | View volume details and host storage path |
| `docker volume rm` | `docker volume rm my-data` | Remove a specific volume |
| `docker volume prune` | `docker volume prune` | Remove all volumes not used by any container |

---

### Run with Volumes and Bind Mounts

| Command | Example | What It Does |
|---|---|---|
| `docker run -v` | `docker run -v my-vol:/app/data my-app` | Mount a named volume for persistent data |
| `docker run -v` | `docker run -v ${PWD}:/app my-app` | Bind mount current directory into container |
| `docker run -v -v` | `docker run -v ${PWD}:/app -v node_modules:/app/node_modules my-app` | Bind mount + protect node_modules with a volume |

---

### Environment Variables

| Command | Example | What It Does |
|---|---|---|
| `docker run -e` | `docker run -e NODE_ENV=production my-app` | Set a single environment variable at runtime |
| `docker run --env-file` | `docker run --env-file .env my-app` | Load all environment variables from a file |
| `docker build --build-arg` | `docker build --build-arg APP_ENV=production -t my-app .` | Pass a build-time argument to override `ARG` defaults |

---

### Development Workflow (Bind Mount + nodemon)

```bash
# Full command for live-reload development:
docker run -it \
  --name bind-demo \
  -v "${PWD}:/app" \
  -v node_modules:/app/node_modules \
  -w /app \
  -p 5000:5000 \
  node:20-alpine \
  sh -c "npm install -g nodemon && npm install && nodemon --watch /app --legacy-watch index.js"
```

---

### Data Category Summary

| Data Type | Storage | Persists? | Example |
|---|---|---|---|
| App code | Image layers | Until rebuild | `index.js`, `main.py` |
| Temp runtime data | Container writable layer | ✗ Dies with container | Logs, sessions |
| Persistent data | Named volume | ✓ Survives container removal | DB files, uploads |

---

### Volume Type Summary

| Volume Type | Syntax | Name | Use Case |
|---|---|---|---|
| Named Volume | `-v my-vol:/app/data` | Custom (e.g., `my-vol`) | Production persistent data |
| Anonymous Volume | `-v /app/data` | Random ID | Temporary isolated data |
| Bind Mount | `-v ${PWD}:/app` | Host path | Local development, live code |

---

<div align="center">
  <p style="font-size: 1.1em; font-weight: bold;">Habibur Rahman Zihad</p>
  <p style="color: gray; font-size: 0.95em;">Full-Stack Developer</p>
  <p style="color: gray; font-size: 0.85em;">© 2026 All Rights Reserved</p>
</div>
