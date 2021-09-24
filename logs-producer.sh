#!/bin/bash

docker-compose -p producer logs -f --tail 1000 $1

