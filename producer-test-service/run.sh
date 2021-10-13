#!/bin/bash

docker run \
	--name producerTestContainer \
	-i --tty \
	--volume `pwd`/app/:/app/ \
	--publish 85:80 \
	producertestservice:latest

