#!/bin/bash

docker-compose -f docker-compose.yml -f docker-compose.consumer.yml -p consumer up -d

