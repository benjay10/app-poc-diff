#!/bin/bash

docker run \
	--name producerAppContainer \
	-i --tty \
	--volume `pwd`/app/:/app/ \
	--publish 81:80 \
	producerconsumerapp:latest

