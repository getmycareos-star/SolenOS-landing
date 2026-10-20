#!/bin/bash
# Script to start OpenTelemetry stack for local development

echo "Starting OpenTelemetry stack for SolenOS..."
echo "This will start:"
echo "  - OpenTelemetry Collector (OTLP receiver on 4317/grpc, 4318/http)"
echo "  - Jaeger for trace visualization (http://localhost:16686)"
echo "  - Prometheus for metrics storage (http://localhost:9090)"
echo ""

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

# Start the telemetry stack
$DOCKER_COMPOSE -f docker-compose.telemetry.yml up -d

echo ""
echo "Telemetry stack started!"
echo "View traces at: http://localhost:16686"
echo "View metrics at: http://localhost:9090"
echo ""
echo "To stop the stack, run:"
echo "  $DOCKER_COMPOSE -f docker-compose.telemetry.yml down"