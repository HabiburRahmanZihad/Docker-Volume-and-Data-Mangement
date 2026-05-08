topics-

1- why volume and data management matters in docker?

containers are designed to be
-replaceable
-restartable
-disposable

what we store in docker container
-database
-user uploads 
-authentication sessions
-logs
-configuration files


2- Understanding Data Categories
- App code
- Temp runtime data
- Persistent data


3- The Writable Container Layer Explained
4- Understanding Docker Volume
-docker volume types
*anonymous
*named

5- Managing Volumes with the Docker CLI [all commands]
6- Hands-on Docker Bind Mounts

bind mount command: docker run -it --name bind-demo -v "${PWD}:/app" -w /app -p 5000:5000 node:20-alpine sh -c "npm install -g nodemon && npm install && nodemon --watch /app --legacy-watch index.js"

7- Solving A Classic Problem Combining Volumes and Bind Mounts

8- Environment Variables and .env Files
3 method to set environment variables in docker
1- using docker run command with -e flag
2- using docker run command with --env-file flag
3- using Dockerfile with ENV instruction

9- The .dockerignore File

Quick Reference Cheat Sheet
Real Command	Example Command	Usage