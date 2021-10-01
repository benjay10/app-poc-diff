#!/bin/bash

# USAGE
# Use this file by executing
#
#	`source aliases.sh`
#
# on the command line and use that bash shell to perform the docker-compose commands.

# Create aliases to the long docker-compse commands

alias dc-p="docker compose -f docker-compose.yml -f docker-compose.producer.yml -p producer"
alias dc-c="docker compose -f docker-compose.yml -f docker-compose.consumer.yml -p consumer"

alias dc-pl="docker compose -f docker-compose.yml -f docker-compose.producer.yml -p producer logs -f --tail 1000"
alias dc-cl="docker compose -f docker-compose.yml -f docker-compose.producer.yml -p consumer logs -f --tail 1000"

