#!/bin/bash

docker-compose -f docker-compose.yml -f docker-compose.producer.yml -p producer up -d
