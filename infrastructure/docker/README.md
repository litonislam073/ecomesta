# Development Docker notes
#
# Primary local dependencies (Postgres + Redis) are defined in the
# repository-root docker-compose.yml for convenience.
#
# Application containers can be added here later when a fully
# containerized workflow is required.

version: "3.9"

# Intentionally minimal — prefer root docker-compose.yml for day-to-day use.
