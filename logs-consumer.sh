#!/bin/bash

docker-compose -p consumer logs -f --tail 1000 $1

