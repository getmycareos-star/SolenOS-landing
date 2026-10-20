#!/bin/bash
# Script to stop OpenTelemetry stack for local development

# Check if docker compose is available
if ! command -v docker-compose &> /dev/null
then
    echo "docker-compose not found, trying docker compose..."
    if ! command -v docker compose &> /dev/null
    then
        echo "Error: Neither docker-compose nor docker compose plugin found"
        echo "Please install Docker Compose to use this script"
        exit 1
    fi
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Stop the telemetry stack
$DOCKER_COMPOSE -f docker-compose.telemetry.yml down

echo "Telemetry stack stopped."