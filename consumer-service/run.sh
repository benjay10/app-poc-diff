#!/bin/bash

docker run \
	--name consumerAppContainer \
	-i --tty \
	--volume `pwd`/app/:/app/ \
	--publish 82:80 \
	producerconsumerapp:latest

