#!/bin/bash

docker run \
	--name producerAppContainer \
	-i --tty \
	--volume `pwd`/app/:/app/ \
	--volume `pwd`/../data/files:/share \
	--publish 83:80 \
	producerconsumerapp:latest

